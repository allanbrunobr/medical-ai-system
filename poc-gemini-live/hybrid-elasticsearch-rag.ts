/**
 * Hybrid Elasticsearch RAG
 * Busca híbrida combinando embeddings semânticos + busca textual
 * Baseado no fluxo do test-complete-flow.js
 */

import { googleEmbeddings } from './google-embeddings';
import { StructuredMedicalEntities } from './structured-medical-extractor';
import { getElasticsearchConfig, getElasticsearchHeaders } from './elasticsearch-config';

interface ElasticsearchConfig {
  url: string;
  apiKey: string;
  embeddingsIndex: string;
  textIndex: string;
}

interface EmbeddingSearchResult {
  disease: string;
  score: number;
  source: 'embedding';
  similarity: string;
  _source?: any;
}

interface TextSearchResult {
  disease: string;
  score: number;
  source: 'text';
  symptoms?: any;
  _source?: any;
}

type HybridSearchResult = EmbeddingSearchResult | TextSearchResult;

export interface HybridSearchResponse {
  results: HybridSearchResult[];
  total_found: number;
  embedding_results: number;
  text_results: number;
  search_time_ms: number;
  confidence_score: number;
}

export class HybridElasticsearchRAG {
  private config: ElasticsearchConfig;
  private enabled = true;

  constructor() {
    // Use environment-aware configuration (browser vs Node.js)
    const envConfig = getElasticsearchConfig();
    
    this.config = {
      url: envConfig.url,
      apiKey: envConfig.apiKey,
      embeddingsIndex: 'medical-embeddings',
      textIndex: 'search-medical-2'
    };

    console.log('🔍 Hybrid Elasticsearch RAG initialized');
    console.log(`  🌐 Environment: ${envConfig.useProxy ? 'Browser (using proxy)' : 'Node.js (direct)'}`);
    console.log(`  📊 Embeddings index: ${this.config.embeddingsIndex}`);
    console.log(`  📝 Text index: ${this.config.textIndex}`);
    console.log(`  🔗 URL: ${this.config.url}`);
  }

  /**
   * Busca híbrida principal combinando embeddings + texto
   */
  async hybridMedicalSearch(
    entities: StructuredMedicalEntities,
    embeddingText: string,
    elasticsearchQuery: string,
    options: {
      max_results?: number;
      min_embedding_score?: number;
      min_text_score?: number;
    } = {}
  ): Promise<HybridSearchResponse> {

    if (!this.enabled) {
      return this.getEmptyResponse();
    }

    const startTime = Date.now();
    const maxResults = options.max_results || 5;

    console.log('🔍 === HYBRID ELASTICSEARCH SEARCH ===');
    console.log(`🧠 Embedding text: "${embeddingText}"`);
    console.log(`📝 Text query: "${elasticsearchQuery}"`);

    try {
      // Executar buscas em paralelo
      const [embeddingResults, textResults] = await Promise.allSettled([
        this.searchByEmbeddings(embeddingText, maxResults, options.min_embedding_score),
        this.searchByText(entities, elasticsearchQuery, maxResults, options.min_text_score)
      ]);

      // Processar resultados dos embeddings
      const embeddingHits: EmbeddingSearchResult[] = embeddingResults.status === 'fulfilled' 
        ? embeddingResults.value 
        : [];

      // Processar resultados textuais
      const textHits: TextSearchResult[] = textResults.status === 'fulfilled' 
        ? textResults.value 
        : [];

      console.log(`✅ Embedding search: ${embeddingHits.length} results`);
      console.log(`✅ Text search: ${textHits.length} results`);

      // Combinar e remover duplicatas
      const combinedResults = this.combineAndDeduplicateResults(embeddingHits, textHits);
      
      // Ordenar por score (híbrido)
      const sortedResults = this.rankHybridResults(combinedResults);
      
      // Selecionar top resultados
      const finalResults = sortedResults.slice(0, maxResults);

      const searchTime = Date.now() - startTime;
      const confidenceScore = this.calculateConfidenceScore(finalResults, entities);

      console.log('\n🎯 HYBRID SEARCH RESULTS:');
      finalResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.disease}`);
        console.log(`     Source: ${result.source}, Score: ${result.score.toFixed(2)}`);
        if (result.source === 'embedding') {
          console.log(`     Similarity: ${result.similarity}%`);
        }
      });

      console.log(`\n📊 Search completed in ${searchTime}ms`);
      console.log(`🎯 Confidence score: ${(confidenceScore * 100).toFixed(1)}%`);

      return {
        results: finalResults,
        total_found: combinedResults.length,
        embedding_results: embeddingHits.length,
        text_results: textHits.length,
        search_time_ms: searchTime,
        confidence_score: confidenceScore
      };

    } catch (error) {
      console.error('❌ Hybrid search error:', error);
      return this.getEmptyResponse();
    }
  }

  /**
   * Busca por embeddings semânticos
   */
  private async searchByEmbeddings(
    embeddingText: string, 
    maxResults: number,
    minScore = 1.1
  ): Promise<EmbeddingSearchResult[]> {
    
    console.log('🧠 Searching by embeddings...');

    try {
      // Gerar embedding
      const embedding = await googleEmbeddings.generateEmbedding(embeddingText);
      
      if (!embedding) {
        console.warn('⚠️ Failed to generate embedding');
        return [];
      }

      // Query para busca por embedding
      const embeddingQuery = {
        size: maxResults,
        query: {
          script_score: {
            query: { match_all: {} },
            script: {
              source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
              params: { query_vector: embedding }
            }
          }
        },
        min_score: minScore
      };

      const response = await fetch(`${this.config.url}/${this.config.embeddingsIndex}/_search`, {
        method: 'POST',
        headers: getElasticsearchHeaders(),
        body: JSON.stringify(embeddingQuery)
      });

      if (!response.ok) {
        throw new Error(`Elasticsearch embedding search failed: ${response.status}`);
      }

      const data = await response.json();
      const hits = data.hits?.hits || [];

      const results: EmbeddingSearchResult[] = hits.map((hit: any) => ({
        disease: hit._source.disease || hit._source.Disease || 'Unknown',
        score: hit._score,
        source: 'embedding',
        similarity: ((hit._score - 1) * 100).toFixed(1),
        _source: hit._source
      }));

      console.log(`  🧠 Found ${results.length} embedding results`);
      return results;

    } catch (error) {
      console.error('❌ Embedding search error:', error);
      return [];
    }
  }

  /**
   * Busca textual estruturada
   */
  private async searchByText(
    entities: StructuredMedicalEntities,
    query: string,
    maxResults: number,
    minScore = 1.0
  ): Promise<TextSearchResult[]> {
    
    console.log('📝 Searching by text...');

    try {
      // Construir query textual otimizada
      const textQuery = this.buildOptimizedTextQuery(entities, query, maxResults, minScore);

      const response = await fetch(`${this.config.url}/${this.config.textIndex}/_search`, {
        method: 'POST',
        headers: getElasticsearchHeaders(),
        body: JSON.stringify(textQuery)
      });

      if (!response.ok) {
        throw new Error(`Elasticsearch text search failed: ${response.status}`);
      }

      const data = await response.json();
      const hits = data.hits?.hits || [];

      const results: TextSearchResult[] = hits.map((hit: any) => ({
        disease: hit._source.disease || hit._source.Disease || 'Unknown',
        score: hit._score,
        source: 'text',
        symptoms: hit._source.symptoms,
        _source: hit._source
      }));

      console.log(`  📝 Found ${results.length} text results`);
      return results;

    } catch (error) {
      console.error('❌ Text search error:', error);
      return [];
    }
  }

  /**
   * Constrói query textual otimizada baseada nas entidades
   */
  private buildOptimizedTextQuery(
    entities: StructuredMedicalEntities,
    query: string,
    maxResults: number,
    minScore: number
  ): any {
    
    const shouldClauses: any[] = [];

    // 1. Busca na doença principal
    shouldClauses.push({
      match: {
        disease: {
          query: query,
          boost: 3.0,
          fuzziness: 'AUTO'
        }
      }
    });

    // 2. Busca nas condições específicas
    entities.conditions.forEach(condition => {
      if (condition.en) {
        shouldClauses.push({
          match: {
            disease: {
              query: condition.en,
              boost: 2.5
            }
          }
        });
      }
    });

    // 3. Busca por sintomas específicos (se existirem campos de sintomas)
    const symptomFields = this.getSymptomFields(entities.symptoms);
    if (symptomFields.length > 0) {
      shouldClauses.push({
        bool: {
          must: symptomFields,
          boost: 2.0
        }
      });
    }

    // 4. Busca genérica nos sintomas em inglês
    const symptomsEn = entities.symptoms.map(s => s.en).filter(s => s).join(' ');
    if (symptomsEn) {
      shouldClauses.push({
        multi_match: {
          query: symptomsEn,
          fields: ['symptoms.*', 'description', 'clinical_presentation'],
          boost: 1.5
        }
      });
    }

    return {
      size: maxResults,
      query: {
        bool: {
          should: shouldClauses,
          minimum_should_match: 1
        }
      },
      min_score: minScore
    };
  }

  /**
   * Mapeia sintomas para campos específicos do Elasticsearch
   */
  private getSymptomFields(symptoms: any[]): any[] {
    const fields: any[] = [];
    
    symptoms.forEach(symptom => {
      const symptomEn = symptom.en?.toLowerCase();
      
      // Mapeamento de sintomas para campos específicos
      const symptomMapping: { [key: string]: string } = {
        'shortness of breath': 'symptoms.shortness_of_breath',
        'dyspnea': 'symptoms.shortness_of_breath',
        'peripheral edema': 'symptoms.peripheral_edema',
        'swelling': 'symptoms.peripheral_edema',
        'chest pain': 'symptoms.chest_pain',
        'fatigue': 'symptoms.fatigue',
        'palpitations': 'symptoms.palpitations'
      };

      for (const [key, field] of Object.entries(symptomMapping)) {
        if (symptomEn?.includes(key)) {
          fields.push({ term: { [field]: true } });
          break;
        }
      }
    });

    return fields;
  }

  /**
   * Combina e remove duplicatas dos resultados
   */
  private combineAndDeduplicateResults(
    embeddingResults: EmbeddingSearchResult[],
    textResults: TextSearchResult[]
  ): HybridSearchResult[] {
    
    const combinedMap = new Map<string, HybridSearchResult>();

    // Adicionar resultados de embedding
    embeddingResults.forEach(result => {
      const key = result.disease.toLowerCase().trim();
      combinedMap.set(key, result);
    });

    // Adicionar resultados textuais (se não existir ou se score for maior)
    textResults.forEach(result => {
      const key = result.disease.toLowerCase().trim();
      const existing = combinedMap.get(key);
      
      if (!existing || result.score > existing.score) {
        combinedMap.set(key, result);
      }
    });

    return Array.from(combinedMap.values());
  }

  /**
   * Rankeia resultados híbridos
   */
  private rankHybridResults(results: HybridSearchResult[]): HybridSearchResult[] {
    return results.sort((a, b) => {
      // Priorizar embeddings com score alto
      if (a.source === 'embedding' && b.source === 'text' && a.score > 1.3) {
        return -1;
      }
      if (b.source === 'embedding' && a.source === 'text' && b.score > 1.3) {
        return 1;
      }
      
      // Ordenar por score
      return b.score - a.score;
    });
  }

  /**
   * Calcula score de confiança baseado nos resultados
   */
  private calculateConfidenceScore(
    results: HybridSearchResult[], 
    entities: StructuredMedicalEntities
  ): number {
    if (results.length === 0) return 0;

    let confidence = entities.confidence || 0.5;
    
    // Boost para resultados de embedding com score alto
    const highScoreEmbeddings = results.filter(r => 
      r.source === 'embedding' && r.score > 1.4
    ).length;
    
    confidence += highScoreEmbeddings * 0.1;
    
    // Boost para concordância entre embedding e texto
    const embeddingDiseases = new Set(
      results.filter(r => r.source === 'embedding').map(r => r.disease.toLowerCase())
    );
    const textDiseases = new Set(
      results.filter(r => r.source === 'text').map(r => r.disease.toLowerCase())
    );
    
    const intersection = new Set([...embeddingDiseases].filter(x => textDiseases.has(x)));
    if (intersection.size > 0) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Retorna resposta vazia
   */
  private getEmptyResponse(): HybridSearchResponse {
    return {
      results: [],
      total_found: 0,
      embedding_results: 0,
      text_results: 0,
      search_time_ms: 0,
      confidence_score: 0
    };
  }

  /**
   * Habilita/desabilita o serviço
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`🔍 Hybrid Elasticsearch RAG ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Verifica se está disponível
   */
  isAvailable(): boolean {
    return this.enabled && !!this.config.url && !!this.config.apiKey;
  }
}

// Singleton instance
export const hybridElasticsearchRAG = new HybridElasticsearchRAG();