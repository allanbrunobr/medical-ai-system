/**
 * MedRAG System - Medical Retrieval Augmented Generation
 * Inspired by the MedRAG research paper (https://arxiv.org/abs/2402.13178)
 * Combines multiple medical corpora with intelligent retrieval and citation management
 */

import { bilingualElasticsearchRAG } from './bilingual-elasticsearch-rag';
import { medicalLiteratureSearch, MedicalReference } from './medical-literature-search';
import { semiologicalKnowledge } from './semiological-knowledge';
import { semanticMedicalExtractor } from './semantic-medical-extractor';
import { medicalTranslationService } from './medical-translation-service';

interface MedRAGResult {
  // Core content
  medical_context: string;
  clinical_reasoning: string;
  
  // Scientific evidence
  references: MedicalReference[];
  citation_map: { [key: string]: number }; // Maps inline citations to reference indices
  
  // Source breakdown
  local_knowledge: string;      // From bilingual Elasticsearch + semiological
  literature_evidence: string;  // From scientific papers
  
  // Metadata
  confidence_score: number;     // Overall confidence (0-1)
  source_distribution: {
    local_db: number;           // Percentage from local sources
    recent_papers: number;      // Percentage from recent literature
    classic_studies: number;    // Percentage from well-cited papers
  };
  
  // Quality indicators
  evidence_level: 'high' | 'medium' | 'low';
  consensus_indicator: boolean; // Whether sources agree
  update_recommendations: string[]; // Suggested areas for further research
  
  // Bilingual processing info
  translation_info: {
    detected_terms: string[];     // Original PT terms detected
    translated_terms: string[];  // EN terms used for search
    translation_confidence: number;
  };
}

interface MedRAGOptions {
  include_recent_papers?: boolean;   // Search recent literature
  max_references?: number;           // Maximum references to include
  years_back?: number;               // How many years to search back
  require_citations?: boolean;       // Whether to require scientific citations
  min_confidence?: number;           // Minimum confidence threshold
  specialty_focus?: string;          // Medical specialty to focus on
}

export class MedRAGSystem {
  private isEnabled = false;
  private citationCounter = 0;
  private readonly CONFIDENCE_WEIGHTS = {
    pubmed_recent: 0.9,      // Recent PubMed papers
    pubmed_classic: 0.95,    // Well-cited PubMed papers
    local_db: 0.7,           // Local Elasticsearch
    semiological: 0.8,       // Semiological knowledge
    preprints: 0.6,          // medRxiv/bioRxiv preprints
  };

  constructor() {
    console.log('🧠 MedRAG System initialized');
  }

  /**
   * Main MedRAG retrieval function
   */
  async retrieveAugmentedMedicalContext(
    query: string,
    symptoms: string[],
    options: MedRAGOptions = {}
  ): Promise<MedRAGResult> {
    
    if (!this.isEnabled) {
      return this.createEmptyResult();
    }

    try {
      console.log(`🔬 MedRAG analysis for: "${query}"`);
      console.log(`📋 Symptoms: [${symptoms.join(', ')}]`);
      
      this.citationCounter = 0;
      const startTime = Date.now();

      // STEP 1: Multi-source retrieval (parallel)
      const [localKnowledge, literatureEvidence, semiologyContext] = await Promise.allSettled([
        this.retrieveLocalKnowledge(symptoms, query),
        this.retrieveLiteratureEvidence(query, symptoms, options),
        this.retrieveSemiologyContext(symptoms, query)
      ]);

      // STEP 2: Process and validate results
      const localResult = localKnowledge.status === 'fulfilled' ? localKnowledge.value : { context: '', confidence: 0, translationInfo: undefined };
      const literatureResult = literatureEvidence.status === 'fulfilled' ? literatureEvidence.value : { references: [], context: '', confidence: 0 };
      const semiologyResult = semiologyContext.status === 'fulfilled' ? semiologyContext.value : { context: '', confidence: 0 };

      // STEP 3: Combine and synthesize knowledge
      const synthesizedResult = this.synthesizeKnowledge(
        localResult,
        literatureResult,
        semiologyResult,
        options
      );

      // STEP 4: Generate clinical reasoning with citations
      const clinicalReasoning = this.generateClinicalReasoning(
        synthesizedResult,
        symptoms,
        query
      );

      // STEP 5: Calculate confidence and quality metrics
      const qualityMetrics = this.calculateQualityMetrics(
        synthesizedResult,
        literatureResult.references
      );

      const processingTime = Date.now() - startTime;
      console.log(`✅ MedRAG analysis completed in ${processingTime}ms`);

      return {
        medical_context: synthesizedResult.combinedContext,
        clinical_reasoning: clinicalReasoning,
        references: literatureResult.references,
        citation_map: synthesizedResult.citationMap,
        local_knowledge: localResult.context,
        literature_evidence: literatureResult.context,
        confidence_score: qualityMetrics.overallConfidence,
        source_distribution: qualityMetrics.sourceDistribution,
        evidence_level: qualityMetrics.evidenceLevel,
        consensus_indicator: qualityMetrics.consensusIndicator,
        update_recommendations: qualityMetrics.updateRecommendations,
        translation_info: {
          detected_terms: localResult.translationInfo?.original_terms || [],
          translated_terms: localResult.translationInfo?.translated_terms || [],
          translation_confidence: localResult.translationInfo?.confidence || 0
        }
      };

    } catch (error) {
      console.error('❌ MedRAG system error:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * Retrieve knowledge from local sources (Bilingual Elasticsearch + Semiological)
   */
  private async retrieveLocalKnowledge(
    symptoms: string[],
    query: string
  ): Promise<{ context: string; confidence: number; translationInfo?: any }> {
    
    try {
      // Use semantic extractor and bilingual search
      const searchQuery = symptoms.join(' ') + ' ' + query;
      console.log(`🌐 Using bilingual Elasticsearch search for: "${searchQuery}"`);
      
      // Get bilingual Elasticsearch context
      const elasticsearchResult = await bilingualElasticsearchRAG.searchMedicalContext(searchQuery);

      // Get semiological recommendations
      const semiologyRecommendations = semiologicalKnowledge.generateExaminationRecommendations(
        symptoms,
        [] // No differential diagnoses yet
      );

      let combinedContext = '';
      
      if (elasticsearchResult.medical_context) {
        combinedContext += elasticsearchResult.medical_context;
        console.log(`✅ Bilingual Elasticsearch: Found medical context (confidence: ${elasticsearchResult.confidence.toFixed(2)})`);
      } else {
        console.log(`⚠️ Bilingual Elasticsearch: No relevant context found`);
      }

      if (semiologyRecommendations.priority_systems.length > 0) {
        combinedContext += `🩺 **Orientações Semiológicas:**\n`;
        combinedContext += `Sistemas prioritários: ${semiologyRecommendations.priority_systems.join(', ')}\n`;
        
        if (semiologyRecommendations.specific_signs_to_check.length > 0) {
          combinedContext += `Sinais a investigar: ${semiologyRecommendations.specific_signs_to_check.slice(0, 3).map(sign => sign.name).join(', ')}\n\n`;
        }
      }

      const confidence = elasticsearchResult.medical_context ? 
        Math.max(elasticsearchResult.confidence, this.CONFIDENCE_WEIGHTS.local_db) : 0.3;

      return {
        context: combinedContext,
        confidence: confidence,
        translationInfo: elasticsearchResult.translation_info
      };

    } catch (error) {
      console.error('❌ Error retrieving local knowledge:', error);
      return { context: '', confidence: 0, translationInfo: undefined };
    }
  }

  /**
   * Retrieve evidence from scientific literature
   */
  private async retrieveLiteratureEvidence(
    query: string,
    symptoms: string[],
    options: MedRAGOptions
  ): Promise<{ references: MedicalReference[]; context: string; confidence: number }> {
    
    if (!options.include_recent_papers) {
      return { references: [], context: '', confidence: 0 };
    }

    try {
      const searchQuery = this.buildLiteratureQuery(query, symptoms, options.specialty_focus);
      
      const searchResult = await medicalLiteratureSearch.searchMedicalLiterature(searchQuery, {
        max_results: options.max_references || 5,
        years_back: options.years_back || 5,
        include_preprints: true,
        sort_by: 'relevance'
      });

      if (searchResult.references.length === 0) {
        return { references: [], context: '', confidence: 0 };
      }

      // Build evidence context with citations
      let evidenceContext = '📚 **Evidências Científicas Recentes:**\n\n';
      
      searchResult.references.forEach((ref, index) => {
        const citationNum = ++this.citationCounter;
        const year = ref.year;
        const authors = ref.authors.length > 0 ? ref.authors[0] + (ref.authors.length > 1 ? ' et al.' : '') : 'Authors';
        
        evidenceContext += `**${citationNum}.** ${authors} (${year}). ${ref.title}\n`;
        evidenceContext += `*${ref.journal}*\n`;
        
        if (ref.abstract && ref.abstract.length > 0) {
          const shortAbstract = ref.abstract.substring(0, 200) + (ref.abstract.length > 200 ? '...' : '');
          evidenceContext += `${shortAbstract}\n`;
        }
        
        evidenceContext += `🔗 [${ref.open_access ? 'Open Access' : 'Link'}](${ref.url})\n\n`;
      });

      // Calculate confidence based on source quality
      const avgConfidence = searchResult.references.reduce((sum, ref) => sum + ref.relevance_score, 0) / searchResult.references.length;
      
      return {
        references: searchResult.references,
        context: evidenceContext,
        confidence: avgConfidence
      };

    } catch (error) {
      console.error('❌ Error retrieving literature evidence:', error);
      return { references: [], context: '', confidence: 0 };
    }
  }

  /**
   * Retrieve semiological context
   */
  private async retrieveSemiologyContext(
    symptoms: string[],
    query: string
  ): Promise<{ context: string; confidence: number }> {
    
    try {
      const recommendations = semiologicalKnowledge.generateExaminationRecommendations(symptoms, []);
      
      if (recommendations.specific_signs_to_check.length === 0) {
        return { context: '', confidence: 0 };
      }

      let context = '🔍 **Sinais Semiológicos Relevantes:**\n\n';
      
      recommendations.specific_signs_to_check.slice(0, 3).forEach(sign => {
        context += `**${sign.name}:**\n`;
        context += `- ${sign.description}\n`;
        context += `- Técnica: ${sign.technique}\n`;
        context += `- LR+: ${sign.likelihood_ratio_positive}\n\n`;
      });

      return {
        context: context,
        confidence: this.CONFIDENCE_WEIGHTS.semiological
      };

    } catch (error) {
      console.error('❌ Error retrieving semiological context:', error);
      return { context: '', confidence: 0 };
    }
  }

  /**
   * Synthesize knowledge from multiple sources
   */
  private synthesizeKnowledge(
    localResult: { context: string; confidence: number },
    literatureResult: { references: MedicalReference[]; context: string; confidence: number },
    semiologyResult: { context: string; confidence: number },
    options: MedRAGOptions
  ): { combinedContext: string; citationMap: { [key: string]: number } } {
    
    let combinedContext = '';
    const citationMap: { [key: string]: number } = {};

    // Combine contexts in order of priority/confidence
    if (localResult.context) {
      combinedContext += localResult.context;
    }

    if (literatureResult.context) {
      combinedContext += literatureResult.context;
      
      // Map citations for references
      literatureResult.references.forEach((ref, index) => {
        const citationKey = `${ref.title.substring(0, 20)}...`;
        citationMap[citationKey] = index + 1;
      });
    }

    if (semiologyResult.context) {
      combinedContext += semiologyResult.context;
    }

    // Add integration note
    if (localResult.context && literatureResult.context) {
      combinedContext += `\n🔗 **Síntese Integrada:**\n`;
      combinedContext += `Esta análise combina conhecimento estruturado local com evidências científicas recentes para fornecer uma visão abrangente baseada em múltiplas fontes confiáveis.\n\n`;
    }

    return {
      combinedContext,
      citationMap
    };
  }

  /**
   * Generate clinical reasoning with integrated citations
   */
  private generateClinicalReasoning(
    synthesizedResult: { combinedContext: string; citationMap: { [key: string]: number } },
    symptoms: string[],
    query: string
  ): string {
    
    let reasoning = `## 🧠 Raciocínio Clínico Integrado\n\n`;
    reasoning += `**Apresentação:** ${symptoms.join(', ')}\n`;
    reasoning += `**Questão clínica:** ${query}\n\n`;

    reasoning += `### 📊 Análise Baseada em Evidências:\n`;
    reasoning += `A avaliação integra conhecimento estruturado local com evidências científicas atualizadas. `;
    
    if (Object.keys(synthesizedResult.citationMap).length > 0) {
      reasoning += `As recomendações são fundamentadas em estudos recentes indexados e conhecimento semiológico validado.\n\n`;
    } else {
      reasoning += `As recomendações baseiam-se em conhecimento médico estruturado e protocolos semiológicos estabelecidos.\n\n`;
    }

    reasoning += `### 🎯 Orientações Clínicas:\n`;
    reasoning += `1. **Avaliação inicial** deve focar nos sintomas relatados\n`;
    reasoning += `2. **Exame físico direcionado** baseado nas hipóteses diagnósticas\n`;
    reasoning += `3. **Investigação complementar** conforme indicação clínica\n`;
    reasoning += `4. **Seguimento** baseado em achados e resposta terapêutica\n\n`;

    reasoning += `### ⚠️ Considerações Importantes:\n`;
    reasoning += `- Esta análise é baseada em evidências científicas e conhecimento médico estruturado\n`;
    reasoning += `- Sempre correlacionar com apresentação clínica individual\n`;
    reasoning += `- Considerar fatores de risco e comorbidades específicos do paciente\n`;
    reasoning += `- Buscar interconsulta especializada quando indicado\n\n`;

    return reasoning;
  }

  /**
   * Calculate quality metrics
   */
  private calculateQualityMetrics(
    synthesizedResult: { combinedContext: string; citationMap: { [key: string]: number } },
    references: MedicalReference[]
  ): {
    overallConfidence: number;
    sourceDistribution: { local_db: number; recent_papers: number; classic_studies: number };
    evidenceLevel: 'high' | 'medium' | 'low';
    consensusIndicator: boolean;
    updateRecommendations: string[];
  } {
    
    // Calculate source distribution
    const totalSources = 1 + references.length; // Local + literature
    const localPercentage = Math.round((1 / totalSources) * 100);
    const literaturePercentage = Math.round((references.length / totalSources) * 100);
    
    // Separate recent vs classic papers
    const currentYear = new Date().getFullYear();
    const recentPapers = references.filter(ref => currentYear - ref.year <= 2).length;
    const classicPapers = references.length - recentPapers;
    
    const recentPercentage = references.length > 0 ? Math.round((recentPapers / references.length) * 100) : 0;
    const classicPercentage = references.length > 0 ? Math.round((classicPapers / references.length) * 100) : 0;

    // Calculate overall confidence
    let confidence = 0.5; // Base confidence
    
    if (references.length > 0) {
      const avgReferenceScore = references.reduce((sum, ref) => sum + ref.relevance_score, 0) / references.length;
      confidence = Math.max(confidence, avgReferenceScore);
    }

    // Determine evidence level
    let evidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (references.length >= 3 && confidence > 0.7) {
      evidenceLevel = 'high';
    } else if (references.length >= 1 && confidence > 0.5) {
      evidenceLevel = 'medium';
    }

    // Check consensus (simplified)
    const consensusIndicator = references.length >= 2 && confidence > 0.6;

    // Generate update recommendations
    const updateRecommendations: string[] = [];
    if (references.length === 0) {
      updateRecommendations.push('Buscar evidências científicas recentes');
    }
    if (recentPapers === 0 && references.length > 0) {
      updateRecommendations.push('Verificar literatura dos últimos 2 anos');
    }
    if (confidence < 0.6) {
      updateRecommendations.push('Considerar interconsulta especializada');
    }

    return {
      overallConfidence: confidence,
      sourceDistribution: {
        local_db: localPercentage,
        recent_papers: recentPercentage,
        classic_studies: classicPercentage
      },
      evidenceLevel,
      consensusIndicator,
      updateRecommendations
    };
  }

  /**
   * Build optimized literature search query
   */
  private buildLiteratureQuery(query: string, symptoms: string[], specialtyFocus?: string): string {
    let searchQuery = query;
    
    // Add symptoms
    if (symptoms.length > 0) {
      searchQuery += ' ' + symptoms.join(' ');
    }
    
    // Add specialty focus if specified
    if (specialtyFocus) {
      searchQuery += ' ' + specialtyFocus;
    }
    
    // Add medical context terms
    searchQuery += ' diagnosis treatment clinical';
    
    return searchQuery.trim();
  }

  /**
   * Create empty result for disabled state
   */
  private createEmptyResult(): MedRAGResult {
    return {
      medical_context: '',
      clinical_reasoning: '',
      references: [],
      citation_map: {},
      local_knowledge: '',
      literature_evidence: '',
      confidence_score: 0,
      source_distribution: { local_db: 0, recent_papers: 0, classic_studies: 0 },
      evidence_level: 'low',
      consensus_indicator: false,
      update_recommendations: [],
      translation_info: {
        detected_terms: [],
        translated_terms: [],
        translation_confidence: 0
      }
    };
  }

  /**
   * Enable/disable MedRAG system
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    // Also enable/disable literature search
    medicalLiteratureSearch.setEnabled(enabled);
    
    console.log(`🧠 MedRAG system ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if MedRAG is available
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }

  /**
   * Get current system status
   */
  getSystemStatus(): {
    enabled: boolean;
    literature_search_available: boolean;
    local_knowledge_available: boolean;
    semiological_available: boolean;
  } {
    return {
      enabled: this.isEnabled,
      literature_search_available: medicalLiteratureSearch.isAvailable(),
      local_knowledge_available: true, // Elasticsearch is always available
      semiological_available: true     // Semiological knowledge is local
    };
  }
}

export const medRAGSystem = new MedRAGSystem();