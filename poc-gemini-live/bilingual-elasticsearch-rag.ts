/**
 * Bilingual Elasticsearch RAG
 * Combines text search and semantic embeddings with PT↔EN translation
 * Uses medical-embeddings index and search-medical-2 database
 */

import { medicalTranslationService } from './medical-translation-service';
import { getElasticsearchConfig, getElasticsearchHeaders, INDICES } from './elasticsearch-config';

interface ElasticsearchResult {
  medical_context: string;
  confidence: number;
  sources: SearchSource[];
  translation_info: {
    original_terms: string[];
    translated_terms: string[];
    confidence: number;
  };
}

interface SearchSource {
  content: string;
  score: number;
  source_type: 'text_match' | 'semantic_similarity';
  document_id: string;
}

interface SemanticSearchQuery {
  query_vector: number[];
  text_query: string;
  translated_query: string;
  hybrid_boost: number;
}

export class BilingualElasticsearchRAG {
  private config: ReturnType<typeof getElasticsearchConfig>;
  private enabled: boolean = true;

  constructor() {
    // Use environment-aware configuration
    this.config = getElasticsearchConfig();
    
    console.log('🌐 Bilingual Elasticsearch RAG initialized');
    console.log(`📊 Target index: ${INDICES.MEDICAL_EMBEDDINGS}`);
    console.log(`🗄️ Target database: ${INDICES.SEARCH_MEDICAL_2}`);
    console.log(`🔧 Using ${this.config.useProxy ? 'CORS proxy' : 'direct connection'}`);
  }

  /**
   * Search medical context using hybrid approach (text + embeddings + translation)
   */
  async searchMedicalContext(
    portugueseQuery: string,
    options: {
      max_results?: number;
      semantic_weight?: number;
      text_weight?: number;
      min_score?: number;
    } = {}
  ): Promise<ElasticsearchResult> {
    
    if (!this.enabled || !portugueseQuery.trim()) {
      return this.createEmptyResult();
    }

    console.log(`🔍 Bilingual search for: "${portugueseQuery}"`);
    
    try {
      // Step 1: Translate PT→EN for English database search
      const translationResult = await medicalTranslationService.translatePTtoEN(portugueseQuery);
      
      if (translationResult.translated_terms.length === 0) {
        console.log('❌ No medical terms found for translation');
        return this.createEmptyResult();
      }

      console.log(`🌐 Translated terms: ${translationResult.translated_terms.join(', ')}`);

      // Step 2: Prepare hybrid search (text + semantic)
      const englishQuery = translationResult.translated_terms.join(' ');
      
      // Step 3: Execute hybrid search
      const searchResults = await this.executeHybridSearch({
        text_query: portugueseQuery,
        translated_query: englishQuery,
        query_vector: [], // Will be generated if embeddings are available
        hybrid_boost: options.semantic_weight || 0.6
      }, options);

      // Step 4: Translate results back to Portuguese
      const translatedContext = await this.translateResults(searchResults);

      // Step 5: Build final result
      const result: ElasticsearchResult = {
        medical_context: translatedContext,
        confidence: this.calculateOverallConfidence(searchResults, translationResult.confidence),
        sources: searchResults.slice(0, options.max_results || 5),
        translation_info: {
          original_terms: translationResult.original_terms,
          translated_terms: translationResult.translated_terms,
          confidence: translationResult.confidence
        }
      };

      console.log(`✅ Bilingual search completed:`);
      console.log(`  Sources found: ${result.sources.length}`);
      console.log(`  Overall confidence: ${result.confidence.toFixed(2)}`);
      console.log(`  Translation confidence: ${result.translation_info.confidence.toFixed(2)}`);

      return result;

    } catch (error) {
      console.error('❌ Bilingual search error:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * Execute hybrid search combining text and semantic similarity
   */
  private async executeHybridSearch(
    query: SemanticSearchQuery,
    options: any
  ): Promise<SearchSource[]> {
    
    const searchSources: SearchSource[] = [];

    try {
      // Search 1: Text-based search in English
      console.log('🔍 Executing text-based search...');
      const textResults = await this.executeTextSearch(query.translated_query, options);
      searchSources.push(...textResults);

      // Search 2: Semantic search with embeddings (if available)
      console.log('🧠 Executing semantic search...');
      const semanticResults = await this.executeSemanticSearch(query, options);
      searchSources.push(...semanticResults);

      // Deduplicate and sort by score
      const uniqueSources = this.deduplicateAndRank(searchSources);
      
      console.log(`📊 Hybrid search results: ${uniqueSources.length} unique sources`);
      return uniqueSources;

    } catch (error) {
      console.error('❌ Hybrid search execution error:', error);
      return [];
    }
  }

  /**
   * Execute text-based search in the English database
   */
  private async executeTextSearch(englishQuery: string, options: any): Promise<SearchSource[]> {
    try {
      const searchBody = {
        index: this.SEARCH_MEDICAL_DB,
        size: options.max_results || 10,
        min_score: options.min_score || 0.1,
        query: {
          bool: {
            should: [
              // Search in disease field
              {
                match: {
                  disease: {
                    query: englishQuery,
                    fuzziness: 'AUTO',
                    boost: 3.0
                  }
                }
              },
              // Search for specific symptoms that are true
              ...this.buildSymptomQueries(englishQuery)
            ],
            minimum_should_match: 1
          }
        },
        highlight: {
          fields: {
            'disease': {}
          }
        }
      };

      console.log(`🔍 Text search query: ${englishQuery}`);
      
      const response = await fetch(`${this.config.url}/${INDICES.SEARCH_MEDICAL_2}/_search`, {
        method: 'POST',
        headers: getElasticsearchHeaders(),
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        console.error(`Text search error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const hits = data.hits?.hits || [];

      console.log(`📄 Text search found: ${hits.length} results`);

      return hits.map((hit: any, index: number) => ({
        content: this.formatHitContent(hit._source),
        score: hit._score,
        source_type: 'text_match' as const,
        document_id: hit._id || `text_${index}`
      }));

    } catch (error) {
      console.error('❌ Text search error:', error);
      return [];
    }
  }

  /**
   * Execute semantic search using embeddings
   */
  private async executeSemanticSearch(query: SemanticSearchQuery, options: any): Promise<SearchSource[]> {
    try {
      console.log('🧠 Executing semantic similarity search with embeddings');
      console.log(`📊 Target index: ${this.MEDICAL_EMBEDDINGS_INDEX}`);
      console.log(`🔍 Query: "${query.translated_query}"`);
      
      // Step 1: Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query.translated_query);
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn('⚠️ Could not generate query embedding, falling back to text search');
        return await this.executeEmbeddingTextFallback(query.translated_query, options);
      }
      
      // Step 2: Execute similarity search
      const searchBody = {
        index: this.MEDICAL_EMBEDDINGS_INDEX,
        size: options.max_results || 5,
        query: {
          script_score: {
            query: { match_all: {} },
            script: {
              source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
              params: {
                query_vector: queryEmbedding
              }
            }
          }
        },
        min_score: 1.0 + (options.min_score || 0.1) // Adjust for cosine similarity range
      };

      const response = await fetch(`${this.config.url}/${INDICES.MEDICAL_EMBEDDINGS}/_search`, {
        method: 'POST',
        headers: getElasticsearchHeaders(),
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        console.warn(`Semantic search failed: ${response.status}, falling back to text only`);
        return [];
      }

      const data = await response.json();
      const hits = data.hits?.hits || [];

      console.log(`🧠 Semantic search found: ${hits.length} results`);

      return hits.map((hit: any, index: number) => ({
        content: this.formatHitContent(hit._source),
        score: hit._score * 0.8, // Slightly lower weight for semantic results
        source_type: 'semantic_similarity' as const,
        document_id: hit._id || `semantic_${index}`
      }));

    } catch (error) {
      console.error('❌ Semantic search error:', error);
      return [];
    }
  }

  /**
   * Build symptom-specific queries based on translated terms
   */
  private buildSymptomQueries(englishQuery: string): any[] {
    const queries: any[] = [];
    
    // Map common English terms to symptom field names
    const symptomMapping: { [key: string]: string[] } = {
      'respiratory': ['shortness_of_breath', 'difficulty_breathing', 'cough', 'chest_tightness'],
      'breathing': ['shortness_of_breath', 'difficulty_breathing', 'breathing_fast'],
      'failure': ['shortness_of_breath', 'difficulty_breathing'],
      'edema': ['peripheral_edema', 'leg_swelling', 'foot_or_toe_swelling'],
      'swelling': ['peripheral_edema', 'leg_swelling', 'arm_swelling', 'ankle_swelling'],
      'extremity': ['leg_pain', 'arm_pain', 'leg_swelling'],
      'chest': ['chest_tightness', 'sharp_chest_pain', 'burning_chest_pain'],
      'pain': ['chest_tightness', 'sharp_chest_pain', 'leg_pain', 'arm_pain'],
      'heart': ['palpitations', 'irregular_heartbeat', 'increased_heart_rate'],
      'cardiac': ['palpitations', 'irregular_heartbeat']
    };

    // Create queries for matching symptoms
    for (const [term, symptoms] of Object.entries(symptomMapping)) {
      if (englishQuery.toLowerCase().includes(term)) {
        for (const symptom of symptoms) {
          queries.push({
            term: {
              [`symptoms.${symptom}`]: true
            }
          });
        }
      }
    }

    console.log(`🎯 Generated ${queries.length} symptom queries for: "${englishQuery}"`);
    return queries;
  }

  /**
   * Format hit content for consistent display
   */
  private formatHitContent(source: any): string {
    let content = '';

    // Handle both index formats
    if (source.disease) {
      content += `**Disease:** ${source.disease}\n`;
    } else if (source.Disease) {
      content += `**Disease:** ${source.Disease}\n`;
    }

    // Extract active symptoms from the symptoms object
    if (source.symptoms && typeof source.symptoms === 'object') {
      const activeSymptoms: string[] = [];
      
      for (const [symptom, isActive] of Object.entries(source.symptoms)) {
        if (isActive === true) {
          // Convert snake_case to readable format
          const readableSymptom = symptom.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          activeSymptoms.push(readableSymptom);
        }
      }

      if (activeSymptoms.length > 0) {
        content += `**Active Symptoms:** ${activeSymptoms.slice(0, 8).join(', ')}\n`;
      }
    }

    // Handle legacy symptom format (if any)
    if (source.symptoms && typeof source.symptoms === 'string') {
      content += `**Symptoms:** ${source.symptoms}\n`;
    }

    // Add absent symptoms info if relevant
    if (source.symptoms_absent && Array.isArray(source.symptoms_absent) && source.symptoms_absent.length > 0) {
      content += `**Excluded:** ${source.symptoms_absent.slice(0, 5).join(', ')}\n`;
    }

    return content.trim();
  }

  /**
   * Deduplicate results and rank by combined score
   */
  private deduplicateAndRank(sources: SearchSource[]): SearchSource[] {
    const seen = new Set<string>();
    const unique: SearchSource[] = [];

    // Sort by score first
    const sorted = sources.sort((a, b) => b.score - a.score);

    for (const source of sorted) {
      // Create a hash based on content similarity
      const contentHash = this.createContentHash(source.content);
      
      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        unique.push(source);
      }
    }

    return unique;
  }

  /**
   * Create content hash for deduplication
   */
  private createContentHash(content: string): string {
    // Simple hash based on first 100 characters, normalized
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .substring(0, 100)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Translate search results from English back to Portuguese
   */
  private async translateResults(sources: SearchSource[]): Promise<string> {
    if (sources.length === 0) {
      return '';
    }

    let combinedContent = '🔍 **Informações Médicas Encontradas:**\n\n';

    for (let i = 0; i < Math.min(sources.length, 3); i++) {
      const source = sources[i];
      
      console.log(`🌐 Translating source ${i + 1} (${source.source_type})...`);
      
      // Translate the content from English to Portuguese
      const translatedContent = await medicalTranslationService.translateENtoPT(source.content);
      
      combinedContent += `**${i + 1}.** `;
      combinedContent += `[${source.source_type === 'text_match' ? 'Texto' : 'Semântico'}] `;
      combinedContent += `(Score: ${source.score.toFixed(2)})\n`;
      combinedContent += `${translatedContent}\n\n`;
    }

    return combinedContent;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(sources: SearchSource[], translationConfidence: number): number {
    if (sources.length === 0) {
      return 0;
    }

    // Average of top 3 source scores
    const topSources = sources.slice(0, 3);
    const avgSourceScore = topSources.reduce((sum, source) => sum + source.score, 0) / topSources.length;
    
    // Normalize score (Elasticsearch scores can vary widely)
    const normalizedScore = Math.min(avgSourceScore / 10, 1.0);
    
    // Combine with translation confidence
    return (normalizedScore + translationConfidence) / 2;
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): ElasticsearchResult {
    return {
      medical_context: '',
      confidence: 0,
      sources: [],
      translation_info: {
        original_terms: [],
        translated_terms: [],
        confidence: 0
      }
    };
  }

  /**
   * Generate embedding for query using Google AI API
   */
  private async generateQueryEmbedding(text: string): Promise<number[] | null> {
    try {
      console.log(`🧠 Generating embedding for: "${text.substring(0, 50)}..."`);
      
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
        },
        body: JSON.stringify({
          model: 'models/embedding-001',
          content: {
            parts: [{ text }]
          }
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ Embedding API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const embedding = data.embedding?.values;

      if (embedding && Array.isArray(embedding)) {
        console.log(`✅ Generated embedding: ${embedding.length} dimensions`);
        return embedding;
      } else {
        console.warn('⚠️ Invalid embedding response format');
        return null;
      }

    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Fallback text search in embeddings index when embedding generation fails
   */
  private async executeEmbeddingTextFallback(query: string, options: any): Promise<SearchSource[]> {
    try {
      console.log(`🔄 Fallback text search in ${this.MEDICAL_EMBEDDINGS_INDEX} for: "${query}"`);
      
      const searchBody = {
        index: this.MEDICAL_EMBEDDINGS_INDEX,
        size: options.max_results || 3,
        query: {
          match: {
            disease: {
              query: query,
              fuzziness: 'AUTO'
            }
          }
        }
      };

      const response = await fetch(`${this.config.url}/${INDICES.MEDICAL_EMBEDDINGS}/_search`, {
        method: 'POST',
        headers: getElasticsearchHeaders(),
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        console.warn(`Fallback text search failed: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const hits = data.hits?.hits || [];

      console.log(`🔄 Fallback search found: ${hits.length} results`);

      return hits.map((hit: any, index: number) => ({
        content: this.formatHitContent(hit._source),
        score: hit._score * 0.7, // Lower weight for fallback results
        source_type: 'text_match' as const,
        document_id: hit._id || `fallback_${index}`
      }));

    } catch (error) {
      console.error('❌ Fallback text search error:', error);
      return [];
    }
  }

  /**
   * Enable/disable the service
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`🌐 Bilingual Elasticsearch RAG ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.enabled;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    enabled: boolean;
    target_index: string;
    target_database: string;
    elasticsearch_url: string;
  } {
    return {
      enabled: this.enabled,
      target_index: INDICES.MEDICAL_EMBEDDINGS,
      target_database: INDICES.SEARCH_MEDICAL_2,
      elasticsearch_url: this.config.url,
      using_proxy: this.config.useProxy
    };
  }
}

export const bilingualElasticsearchRAG = new BilingualElasticsearchRAG();