/**
 * Medical Synthesis Engine
 * Sistema de síntese final integrando todas as fontes de dados médicos
 * Baseado no fluxo do test-complete-flow.js
 */

import { StructuredMedicalEntities } from './structured-medical-extractor';
import { HybridSearchResponse } from './hybrid-elasticsearch-rag';
import { MedicalReference } from './medical-literature-search';

export interface CompleteMedicalSynthesis {
  patient_summary: {
    demographics: string;
    presentation: string;
    severity_assessment: string;
  };
  
  primary_diagnosis: {
    condition: string;
    confidence: number;
    reasoning: string;
    evidence_sources: string[];
  };
  
  differential_diagnoses: Array<{
    condition: string;
    probability: number;
    reasoning: string;
    distinguishing_features: string;
  }>;
  
  evidence_analysis: {
    elasticsearch_confidence: number;
    literature_support: number;
    source_concordance: number;
    overall_confidence: number;
  };
  
  clinical_recommendations: {
    immediate_actions: string[];
    diagnostic_workup: string[];
    monitoring_requirements: string[];
    red_flags: string[];
  };
  
  scientific_citations: Array<{
    reference: MedicalReference;
    relevance_to_case: string;
    evidence_level: 'high' | 'moderate' | 'low';
  }>;
  
  synthesis_metadata: {
    total_sources_consulted: number;
    synthesis_time_ms: number;
    ai_confidence: number;
    data_completeness: number;
  };
}

export class MedicalSynthesisEngine {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ Google AI API key not found - synthesis will not work');
    } else {
      console.log('✅ Medical Synthesis Engine initialized');
    }
  }

  /**
   * Síntese completa integrando todas as fontes
   */
  async synthesizeCompleteAnalysis(
    entities: StructuredMedicalEntities,
    elasticsearchResults: HybridSearchResponse,
    pubmedReferences: MedicalReference[],
    additionalContext?: string
  ): Promise<CompleteMedicalSynthesis | null> {

    if (!this.apiKey) {
      console.error('❌ Cannot synthesize - API key missing');
      return null;
    }

    const startTime = Date.now();
    
    console.log('🎯 === MEDICAL SYNTHESIS ENGINE ===');
    console.log(`👤 Patient: ${entities.patient_info.gender}, ${entities.patient_info.age || 'unknown'} anos`);
    console.log(`🔍 Elasticsearch results: ${elasticsearchResults.results.length}`);
    console.log(`📚 PubMed references: ${pubmedReferences.length}`);

    try {
      const prompt = this.buildSynthesisPrompt(
        entities, 
        elasticsearchResults, 
        pubmedReferences, 
        additionalContext
      );

      console.log('🧠 Generating comprehensive medical synthesis...');

      const model = process.env.GEMINI_MODEL_MEDICAL || 'gemini-2.0-flash';
      const response = await fetch(`${this.baseUrl}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.2, 
            maxOutputTokens: 2500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Google AI API error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new Error('No response text received from AI');
      }

      const synthesis = this.parseSynthesisResponse(
        responseText, 
        entities, 
        elasticsearchResults, 
        pubmedReferences,
        Date.now() - startTime
      );

      if (synthesis) {
        console.log('✅ Medical synthesis completed successfully');
        console.log(`  🎯 Primary diagnosis: ${synthesis.primary_diagnosis.condition}`);
        console.log(`  📊 Overall confidence: ${(synthesis.evidence_analysis.overall_confidence * 100).toFixed(1)}%`);
        console.log(`  🕐 Synthesis time: ${synthesis.synthesis_metadata.synthesis_time_ms}ms`);
        
        this.logSynthesisResults(synthesis);
      }

      return synthesis;

    } catch (error) {
      console.error('❌ Error in medical synthesis:', error);
      return null;
    }
  }

  /**
   * Constrói o prompt para síntese médica completa
   */
  private buildSynthesisPrompt(
    entities: StructuredMedicalEntities,
    elasticsearchResults: HybridSearchResponse,
    pubmedReferences: MedicalReference[],
    additionalContext?: string
  ): string {

    const elasticsearchSummary = elasticsearchResults.results
      .slice(0, 5)
      .map((result: any, index: number) => 
        `${index + 1}. ${result.disease} (${result.source} search, score: ${result.score.toFixed(2)})`
      ).join('\n');

    const pubmedSummary = pubmedReferences
      .slice(0, 5)
      .map((ref, index) => 
        `${index + 1}. ${ref.title} (${ref.journal}, ${ref.year}) - ${ref.abstract?.substring(0, 150)}...`
      ).join('\n');

    return `Você é um médico especialista com acesso a múltiplas fontes de evidência. Conduza uma análise médica completa e estruturada.

DADOS DO PACIENTE:
- Demografia: ${entities.patient_info.gender === 'M' ? 'Masculino' : entities.patient_info.gender === 'F' ? 'Feminino' : 'Gênero não especificado'}, ${entities.patient_info.age || 'idade não informada'} anos
- Sintomas: ${entities.symptoms.map(s => s.pt).join(', ')}
- Condições suspeitas: ${entities.conditions.map(c => c.pt).join(', ')}
- Severidade: ${entities.severity}
- Confiança na extração: ${(entities.confidence * 100).toFixed(1)}%

RESULTADOS ELASTICSEARCH (${elasticsearchResults.total_found} total, ${elasticsearchResults.embedding_results} embeddings + ${elasticsearchResults.text_results} texto):
${elasticsearchSummary}

LITERATURA CIENTÍFICA PUBMED (${pubmedReferences.length} papers):
${pubmedSummary}

${additionalContext ? `CONTEXTO ADICIONAL:\n${additionalContext}\n` : ''}

FORNEÇA UMA ANÁLISE ESTRUTURADA EM JSON:

{
  "patient_summary": {
    "demographics": "resumo demográfico",
    "presentation": "apresentação clínica",
    "severity_assessment": "avaliação da gravidade"
  },
  
  "primary_diagnosis": {
    "condition": "diagnóstico principal mais provável",
    "confidence": 0.0_to_1.0,
    "reasoning": "raciocínio baseado em evidências",
    "evidence_sources": ["elasticsearch", "pubmed", "clinical_reasoning"]
  },
  
  "differential_diagnoses": [
    {
      "condition": "diagnóstico diferencial",
      "probability": 0.0_to_1.0,
      "reasoning": "por que considerar",
      "distinguishing_features": "características distintivas"
    }
  ],
  
  "evidence_analysis": {
    "elasticsearch_confidence": 0.0_to_1.0,
    "literature_support": 0.0_to_1.0,
    "source_concordance": 0.0_to_1.0,
    "overall_confidence": 0.0_to_1.0
  },
  
  "clinical_recommendations": {
    "immediate_actions": ["ação imediata 1", "ação 2"],
    "diagnostic_workup": ["exame 1", "exame 2"],
    "monitoring_requirements": ["monitorar 1", "monitorar 2"],
    "red_flags": ["sinal de alarme 1", "sinal 2"]
  },
  
  "scientific_citations": [
    {
      "title": "título do paper relevante",
      "authors": "autores",
      "year": 2024,
      "relevance_to_case": "como se aplica ao caso",
      "evidence_level": "high/moderate/low"
    }
  ]
}

CRITÉRIOS DE ANÁLISE:
1. **Integração de Evidências**: Combine resultados do Elasticsearch com literatura científica
2. **Avaliação de Concordância**: Analise se diferentes fontes concordam
3. **Confiança Baseada em Evidências**: Considere qualidade e quantidade das fontes
4. **Recomendações Práticas**: Foque em ações clínicas concretas
5. **Segurança do Paciente**: Priorize sinais de alarme e ações urgentes

RESPONDA APENAS COM O JSON, SEM TEXTO ADICIONAL.`;
  }

  /**
   * Faz parsing da resposta de síntese
   */
  private parseSynthesisResponse(
    responseText: string,
    entities: StructuredMedicalEntities,
    elasticsearchResults: HybridSearchResponse,
    pubmedReferences: MedicalReference[],
    synthesisTime: number
  ): CompleteMedicalSynthesis | null {

    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.error('❌ No JSON found in synthesis response');
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);

      // Build scientific citations with full reference data
      const scientificCitations = this.buildScientificCitations(
        parsed.scientific_citations || [],
        pubmedReferences
      );

      // Calculate data completeness
      const dataCompleteness = this.calculateDataCompleteness(
        entities,
        elasticsearchResults,
        pubmedReferences
      );

      const synthesis: CompleteMedicalSynthesis = {
        patient_summary: {
          demographics: parsed.patient_summary?.demographics || '',
          presentation: parsed.patient_summary?.presentation || '',
          severity_assessment: parsed.patient_summary?.severity_assessment || ''
        },
        
        primary_diagnosis: {
          condition: parsed.primary_diagnosis?.condition || '',
          confidence: Math.min(Math.max(parsed.primary_diagnosis?.confidence || 0, 0), 1),
          reasoning: parsed.primary_diagnosis?.reasoning || '',
          evidence_sources: parsed.primary_diagnosis?.evidence_sources || []
        },
        
        differential_diagnoses: (parsed.differential_diagnoses || []).map((dd: any) => ({
          condition: dd.condition || '',
          probability: Math.min(Math.max(dd.probability || 0, 0), 1),
          reasoning: dd.reasoning || '',
          distinguishing_features: dd.distinguishing_features || ''
        })),
        
        evidence_analysis: {
          elasticsearch_confidence: Math.min(Math.max(parsed.evidence_analysis?.elasticsearch_confidence || 0, 0), 1),
          literature_support: Math.min(Math.max(parsed.evidence_analysis?.literature_support || 0, 0), 1),
          source_concordance: Math.min(Math.max(parsed.evidence_analysis?.source_concordance || 0, 0), 1),
          overall_confidence: Math.min(Math.max(parsed.evidence_analysis?.overall_confidence || 0, 0), 1)
        },
        
        clinical_recommendations: {
          immediate_actions: parsed.clinical_recommendations?.immediate_actions || [],
          diagnostic_workup: parsed.clinical_recommendations?.diagnostic_workup || [],
          monitoring_requirements: parsed.clinical_recommendations?.monitoring_requirements || [],
          red_flags: parsed.clinical_recommendations?.red_flags || []
        },
        
        scientific_citations: scientificCitations,
        
        synthesis_metadata: {
          total_sources_consulted: elasticsearchResults.total_found + pubmedReferences.length,
          synthesis_time_ms: synthesisTime,
          ai_confidence: entities.confidence,
          data_completeness: dataCompleteness
        }
      };

      return synthesis;

    } catch (error) {
      console.error('❌ Error parsing synthesis response:', error);
      return null;
    }
  }

  /**
   * Constrói citações científicas com referências completas
   */
  private buildScientificCitations(
    aiCitations: any[],
    pubmedReferences: MedicalReference[]
  ): Array<{ reference: MedicalReference; relevance_to_case: string; evidence_level: 'high' | 'moderate' | 'low' }> {
    
    const citations: Array<{ reference: MedicalReference; relevance_to_case: string; evidence_level: 'high' | 'moderate' | 'low' }> = [];

    // Match AI citations with actual PubMed references
    aiCitations.forEach(aiCitation => {
      const matchingRef = pubmedReferences.find(ref => 
        ref.title.toLowerCase().includes(aiCitation.title?.toLowerCase()?.substring(0, 30) || '') ||
        ref.year === aiCitation.year
      );

      if (matchingRef) {
        citations.push({
          reference: matchingRef,
          relevance_to_case: aiCitation.relevance_to_case || 'Relevante para o caso clínico',
          evidence_level: aiCitation.evidence_level || 'moderate'
        });
      }
    });

    // Add top PubMed references if no matches found
    if (citations.length === 0 && pubmedReferences.length > 0) {
      pubmedReferences.slice(0, 3).forEach(ref => {
        citations.push({
          reference: ref,
          relevance_to_case: 'Referência científica relevante identificada automaticamente',
          evidence_level: 'moderate'
        });
      });
    }

    return citations;
  }

  /**
   * Calcula completude dos dados
   */
  private calculateDataCompleteness(
    entities: StructuredMedicalEntities,
    elasticsearchResults: HybridSearchResponse,
    pubmedReferences: MedicalReference[]
  ): number {
    
    let completeness = 0;

    // Patient data completeness (30%)
    if (entities.patient_info.age) completeness += 0.1;
    if (entities.patient_info.gender !== 'unknown') completeness += 0.1;
    if (entities.symptoms.length > 0) completeness += 0.1;

    // Elasticsearch data (35%)
    if (elasticsearchResults.embedding_results > 0) completeness += 0.15;
    if (elasticsearchResults.text_results > 0) completeness += 0.1;
    if (elasticsearchResults.confidence_score > 0.7) completeness += 0.1;

    // Literature data (35%)
    if (pubmedReferences.length > 0) completeness += 0.2;
    if (pubmedReferences.length >= 3) completeness += 0.1;
    if (pubmedReferences.some(ref => ref.abstract)) completeness += 0.05;

    return Math.min(completeness, 1.0);
  }

  /**
   * Log detalhado dos resultados da síntese
   */
  private logSynthesisResults(synthesis: CompleteMedicalSynthesis): void {
    console.log('\n📋 === SYNTHESIS RESULTS ===');
    console.log(`🎯 Primary: ${synthesis.primary_diagnosis.condition} (${(synthesis.primary_diagnosis.confidence * 100).toFixed(1)}%)`);
    
    if (synthesis.differential_diagnoses.length > 0) {
      console.log('🔍 Differentials:');
      synthesis.differential_diagnoses.forEach((dd, i) => {
        console.log(`  ${i + 1}. ${dd.condition} (${(dd.probability * 100).toFixed(1)}%)`);
      });
    }

    console.log(`📊 Evidence: ES ${(synthesis.evidence_analysis.elasticsearch_confidence * 100).toFixed(1)}% | Lit ${(synthesis.evidence_analysis.literature_support * 100).toFixed(1)}% | Overall ${(synthesis.evidence_analysis.overall_confidence * 100).toFixed(1)}%`);
    console.log(`📚 Citations: ${synthesis.scientific_citations.length} scientific references`);
    console.log(`🔧 Data completeness: ${(synthesis.synthesis_metadata.data_completeness * 100).toFixed(1)}%`);
  }

  /**
   * Verifica se o serviço está disponível
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance
export const medicalSynthesisEngine = new MedicalSynthesisEngine();