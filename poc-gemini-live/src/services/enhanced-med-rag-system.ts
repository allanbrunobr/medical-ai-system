/**
 * Enhanced MedRAG System
 * Sistema completo baseado no fluxo do test-complete-flow.js
 * Integra extração semântica, busca híbrida e síntese final
 */

import { structuredMedicalExtractor, StructuredMedicalEntities } from './structured-medical-extractor';
import { googleEmbeddings } from './google-embeddings';
import { hybridElasticsearchRAG, HybridSearchResponse } from './hybrid-elasticsearch-rag';
import { medicalLiteratureSearch, MedicalReference } from './medical-literature-search';
import { medicalSynthesisEngine, CompleteMedicalSynthesis } from './medical-synthesis-engine';

export interface EnhancedMedRAGResult {
  // Core analysis
  structured_entities: StructuredMedicalEntities;
  clinical_reasoning: string;
  
  // Search results
  elasticsearch_results: HybridSearchResponse;
  literature_references: MedicalReference[];
  
  // Complete synthesis
  complete_synthesis: CompleteMedicalSynthesis | null;
  
  // Metadata
  confidence_score: number;
  processing_time_ms: number;
  sources_consulted: number;
  
  // Quality indicators
  evidence_level: 'high' | 'medium' | 'low';
  data_completeness: number;
  
  // For backward compatibility
  references: MedicalReference[];
  medical_context: string;
}

interface EnhancedMedRAGOptions {
  include_recent_papers?: boolean;
  max_references?: number;
  years_back?: number;
  require_citations?: boolean;
  specialty_focus?: string;
  enable_synthesis?: boolean;
  use_mesh_terms?: boolean;
}

export class EnhancedMedRAGSystem {
  private isEnabled = false;

  constructor() {
    console.log('🧠 Enhanced MedRAG System initialized');
    console.log('  ✅ Structured semantic extraction');
    console.log('  ✅ Hybrid Elasticsearch search (embeddings + text)');
    console.log('  ✅ MeSH-enhanced PubMed search');
    console.log('  ✅ AI-powered medical synthesis');
  }

  /**
   * Função principal do Enhanced MedRAG - Fluxo completo do teste
   */
  async retrieveAugmentedMedicalContext(
    transcript: string,
    symptoms: string[],
    options: EnhancedMedRAGOptions = {}
  ): Promise<EnhancedMedRAGResult> {
    
    if (!this.isEnabled) {
      return this.createEmptyResult();
    }

    const startTime = Date.now();
    
    console.log('🚀 === ENHANCED MEDRAG PIPELINE ===');
    console.log(`📝 Input transcript: "${transcript.substring(0, 100)}..."`);
    console.log(`🔍 Accumulated symptoms: [${symptoms.join(', ')}]`);
    console.log(`⚙️ Options:`, options);

    try {
      // FASE 1: EXTRAÇÃO SEMÂNTICA ESTRUTURADA + EMBEDDING
      console.log('\n🧠 === FASE 1: EXTRAÇÃO + EMBEDDING ===');
      
      const structuredEntities = await structuredMedicalExtractor.extractStructuredEntities(transcript);
      
      if (!structuredEntities) {
        console.error('❌ Failed to extract structured entities');
        return this.createEmptyResult();
      }

      // Merge symptoms from accumulation with extracted symptoms
      const allSymptoms = [...new Set([...symptoms, ...structuredEntities.symptoms.map(s => s.pt)])];
      
      // Generate search queries
      const searchQueries = structuredMedicalExtractor.generateHybridSearchQuery(structuredEntities);
      
      console.log(`✅ Extracted entities: ${structuredEntities.conditions.length} conditions, ${structuredEntities.symptoms.length} symptoms`);
      console.log(`🔍 Generated queries:`);
      console.log(`  Embedding: "${searchQueries.embedding_text}"`);
      console.log(`  Elasticsearch: "${searchQueries.elasticsearch_query}"`);
      console.log(`  PubMed: "${searchQueries.pubmed_query}"`);

      // FASE 2: BUSCA HÍBRIDA ELASTICSEARCH (EMBEDDINGS + TEXTO)
      console.log('\n🔍 === FASE 2: BUSCA HÍBRIDA ELASTICSEARCH ===');
      
      const elasticsearchResults = await hybridElasticsearchRAG.hybridMedicalSearch(
        structuredEntities,
        searchQueries.embedding_text,
        searchQueries.elasticsearch_query,
        {
          max_results: options.max_references || 5,
          min_embedding_score: 1.1,
          min_text_score: 1.0
        }
      );

      console.log(`✅ Elasticsearch: ${elasticsearchResults.results.length} results (${elasticsearchResults.embedding_results} embedding + ${elasticsearchResults.text_results} text)`);

      // FASE 3: BUSCA COMPLEMENTAR PUBMED COM MESH
      console.log('\n📚 === FASE 3: PUBMED + MESH TERMS ===');
      
      let literatureReferences: MedicalReference[] = [];
      
      if (options.include_recent_papers !== false) {
        const meshTerms = structuredEntities.conditions
          .filter(c => c.mesh)
          .map(c => c.mesh!);

        const searchTerms = [
          ...structuredEntities.symptoms.map(s => s.en).filter(s => s),
          ...structuredEntities.conditions.map(c => c.en).filter(c => c)
        ];

        console.log(`🏷️ MeSH terms available: [${meshTerms.join(', ')}]`);
        console.log(`📝 Search terms: [${searchTerms.join(', ')}]`);

        const pubmedOptions = {
          max_results: options.max_references || 5,
          years_back: options.years_back || 5,
          include_preprints: true,
          sort_by: 'relevance' as const,
          use_mesh_terms: options.use_mesh_terms !== false && meshTerms.length > 0,
          mesh_terms: meshTerms
        };

        if (meshTerms.length > 0 && options.use_mesh_terms !== false) {
          const searchResult = await medicalLiteratureSearch.searchWithMeshTerms(
            meshTerms,
            searchTerms,
            pubmedOptions
          );
          literatureReferences = searchResult.references;
        } else {
          const searchResult = await medicalLiteratureSearch.searchMedicalLiterature(
            searchQueries.pubmed_query,
            pubmedOptions
          );
          literatureReferences = searchResult.references;
        }

        console.log(`✅ PubMed: ${literatureReferences.length} references found`);
      } else {
        console.log('⏭️ Skipping PubMed search (disabled)');
      }

      // FASE 4: SÍNTESE FINAL COM IA (OPCIONAL)
      console.log('\n🎯 === FASE 4: SÍNTESE FINAL ===');
      
      let completeSynthesis: CompleteMedicalSynthesis | null = null;
      
      if (options.enable_synthesis !== false && medicalSynthesisEngine.isAvailable()) {
        completeSynthesis = await medicalSynthesisEngine.synthesizeCompleteAnalysis(
          structuredEntities,
          elasticsearchResults,
          literatureReferences
        );
        
        if (completeSynthesis) {
          console.log(`✅ Synthesis completed: ${completeSynthesis.primary_diagnosis.condition} (${(completeSynthesis.primary_diagnosis.confidence * 100).toFixed(1)}%)`);
        }
      } else {
        console.log('⏭️ Skipping AI synthesis (disabled or unavailable)');
      }

      // Calcular métricas finais
      const processingTime = Date.now() - startTime;
      const sourcesConsulted = elasticsearchResults.total_found + literatureReferences.length;
      
      // Generate clinical reasoning (fallback if no synthesis)
      const clinicalReasoning = completeSynthesis 
        ? completeSynthesis.primary_diagnosis.reasoning
        : this.generateBasicClinicalReasoning(structuredEntities, elasticsearchResults);

      // Calculate overall confidence
      const confidenceScore = this.calculateOverallConfidence(
        structuredEntities,
        elasticsearchResults,
        literatureReferences,
        completeSynthesis
      );

      // Determine evidence level
      const evidenceLevel = this.determineEvidenceLevel(
        elasticsearchResults,
        literatureReferences,
        confidenceScore
      );

      // Calculate data completeness
      const dataCompleteness = completeSynthesis?.synthesis_metadata.data_completeness || 
        this.calculateBasicDataCompleteness(structuredEntities, elasticsearchResults, literatureReferences);

      const result: EnhancedMedRAGResult = {
        structured_entities: structuredEntities,
        clinical_reasoning: clinicalReasoning,
        elasticsearch_results: elasticsearchResults,
        literature_references: literatureReferences,
        complete_synthesis: completeSynthesis,
        confidence_score: confidenceScore,
        processing_time_ms: processingTime,
        sources_consulted: sourcesConsulted,
        evidence_level: evidenceLevel,
        data_completeness: dataCompleteness,
        
        // Backward compatibility
        references: literatureReferences,
        medical_context: clinicalReasoning
      };

      // Log final results
      this.logFinalResults(result);

      return result;

    } catch (error) {
      console.error('❌ Enhanced MedRAG pipeline error:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * Gera raciocínio clínico básico quando síntese não está disponível
   */
  private generateBasicClinicalReasoning(
    entities: StructuredMedicalEntities,
    elasticsearchResults: HybridSearchResponse
  ): string {
    
    const topConditions = elasticsearchResults.results.slice(0, 3);
    
    if (topConditions.length === 0) {
      return `Paciente ${entities.patient_info.gender === 'M' ? 'masculino' : 'feminino'} ${entities.patient_info.age ? `de ${entities.patient_info.age} anos` : ''} apresentando: ${entities.symptoms.map(s => s.pt).join(', ')}. Gravidade: ${entities.severity}.`;
    }

    const conditionsText = topConditions.map(c => c.disease).join(', ');
    
    return `Baseado na análise dos sintomas (${entities.symptoms.map(s => s.pt).join(', ')}), as condições mais prováveis incluem: ${conditionsText}. Requer avaliação médica para diagnóstico definitivo.`;
  }

  /**
   * Calcula confiança geral do sistema
   */
  private calculateOverallConfidence(
    entities: StructuredMedicalEntities,
    elasticsearchResults: HybridSearchResponse,
    literatureReferences: MedicalReference[],
    synthesis: CompleteMedicalSynthesis | null
  ): number {
    
    if (synthesis) {
      return synthesis.evidence_analysis.overall_confidence;
    }

    let confidence = entities.confidence || 0.5;
    
    // Boost from Elasticsearch results
    if (elasticsearchResults.confidence_score > 0.7) {
      confidence += 0.15;
    }
    
    // Boost from literature
    if (literatureReferences.length >= 3) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Determina nível de evidência
   */
  private determineEvidenceLevel(
    elasticsearchResults: HybridSearchResponse,
    literatureReferences: MedicalReference[],
    confidenceScore: number
  ): 'high' | 'medium' | 'low' {
    
    if (confidenceScore > 0.8 && literatureReferences.length >= 3 && elasticsearchResults.embedding_results > 0) {
      return 'high';
    }
    
    if (confidenceScore > 0.6 && (literatureReferences.length >= 1 || elasticsearchResults.results.length >= 2)) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Calcula completude básica dos dados
   */
  private calculateBasicDataCompleteness(
    entities: StructuredMedicalEntities,
    elasticsearchResults: HybridSearchResponse,
    literatureReferences: MedicalReference[]
  ): number {
    
    let completeness = 0;

    if (entities.symptoms.length > 0) completeness += 0.3;
    if (entities.conditions.length > 0) completeness += 0.2;
    if (elasticsearchResults.results.length > 0) completeness += 0.3;
    if (literatureReferences.length > 0) completeness += 0.2;

    return Math.min(completeness, 1.0);
  }

  /**
   * Log dos resultados finais
   */
  private logFinalResults(result: EnhancedMedRAGResult): void {
    console.log('\n📊 === ENHANCED MEDRAG RESULTS ===');
    console.log(`🎯 Confidence: ${(result.confidence_score * 100).toFixed(1)}%`);
    console.log(`📊 Evidence Level: ${result.evidence_level.toUpperCase()}`);
    console.log(`🔍 Sources: ${result.sources_consulted} total`);
    console.log(`  📂 Elasticsearch: ${result.elasticsearch_results.results.length} (${result.elasticsearch_results.embedding_results} emb + ${result.elasticsearch_results.text_results} text)`);
    console.log(`  📚 Literature: ${result.literature_references.length} papers`);
    console.log(`⏱️ Processing: ${result.processing_time_ms}ms`);
    console.log(`📈 Data completeness: ${(result.data_completeness * 100).toFixed(1)}%`);
    
    if (result.complete_synthesis) {
      console.log(`🎯 Primary diagnosis: ${result.complete_synthesis.primary_diagnosis.condition}`);
      console.log(`🔍 Differentials: ${result.complete_synthesis.differential_diagnoses.length}`);
    }
    
    console.log('✅ ENHANCED MEDRAG PIPELINE COMPLETED');
  }

  /**
   * Cria resultado vazio
   */
  private createEmptyResult(): EnhancedMedRAGResult {
    return {
      structured_entities: {
        patient_info: { gender: 'unknown' },
        conditions: [],
        symptoms: [],
        severity: 'moderate',
        english_query: '',
        confidence: 0
      },
      clinical_reasoning: '',
      elasticsearch_results: {
        results: [],
        total_found: 0,
        embedding_results: 0,
        text_results: 0,
        search_time_ms: 0,
        confidence_score: 0
      },
      literature_references: [],
      complete_synthesis: null,
      confidence_score: 0,
      processing_time_ms: 0,
      sources_consulted: 0,
      evidence_level: 'low',
      data_completeness: 0,
      references: [],
      medical_context: ''
    };
  }

  /**
   * Habilita/desabilita o sistema
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🧠 Enhanced MedRAG System ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Verifica disponibilidade
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }
}

// Singleton instance
export const enhancedMedRAGSystem = new EnhancedMedRAGSystem();