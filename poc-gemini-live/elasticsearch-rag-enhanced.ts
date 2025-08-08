/**
 * Enhanced Elasticsearch RAG integration for Physician Support
 * Extends the original elasticsearch-rag.ts with physician-specific functionality
 * while maintaining full backward compatibility
 */

import { elasticsearchRAG } from './elasticsearch-rag';
import { perplexitySearch } from './perplexity-search';

interface ElasticsearchHit {
  _source: {
    Disease: string;
    [key: string]: string; // Symptom_1, Symptom_2, etc.
  };
  _score: number;
}

interface PhysicianMedicalContext {
  elasticsearch_context: string;
  structured_diseases: DiseaseAnalysis[];
  clinical_reasoning_prompt: string;
  physician_guidance: PhysicianGuidance;
  perplexity_context?: string;
  web_sources?: string[];
}

interface DiseaseAnalysis {
  disease_name: string;
  symptoms_match: string[];
  relevance_score: number;
  symptom_overlap_percentage: number;
}

interface PhysicianGuidance {
  differential_probability_weights: { [disease: string]: number };
  recommended_examination: string[];
  red_flag_indicators: string[];
  clinical_decision_points: string[];
}

export class EnhancedElasticsearchRAG {
  private baseRAG = elasticsearchRAG;
  private physicianMode: boolean = false;

  constructor() {
    console.log('🔬 Enhanced Elasticsearch RAG initialized for physician support');
  }

  /**
   * Toggle between patient mode (original) and physician mode (enhanced)
   */
  setPhysicianMode(enabled: boolean): void {
    this.physicianMode = enabled;
    console.log(`👨‍⚕️ Physician mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Enhanced search that provides physician-specific context
   */
  async searchMedicalContextForPhysician(
    symptoms: string[],
    patientContext?: any
  ): Promise<PhysicianMedicalContext> {
    
    if (!this.physicianMode) {
      // Fallback to original functionality
      const basicContext = await this.baseRAG.searchMedicalContext(symptoms.join(' '));
      return this.convertBasicToPhysicianContext(basicContext, symptoms);
    }

    try {
      console.log(`🔍 Physician search for symptoms: [${symptoms.join(', ')}]`);
      
      // Use the original search but enhance the results
      const elasticsearchContext = await this.baseRAG.searchMedicalContext(symptoms.join(' '));
      
      // Parse the elasticsearch results for structured analysis
      const structuredDiseases = this.parseElasticsearchResults(elasticsearchContext, symptoms);
      
      // Generate physician-specific guidance
      const physicianGuidance = this.generatePhysicianGuidance(structuredDiseases, symptoms);
      
      // Search for current medical information via Perplexity
      let perplexityContext = '';
      let webSources: string[] = [];
      
      if (perplexitySearch.isAvailable() && symptoms.length > 0) {
        try {
          console.log('🌐 Searching current medical information via Perplexity...');
          const perplexityResult = await perplexitySearch.searchDiagnosticCriteria(symptoms);
          
          if (perplexityResult.content && !perplexityResult.error) {
            perplexityContext = perplexityResult.content;
            webSources = perplexityResult.sources || [];
            console.log('✅ Current medical information retrieved via Perplexity');
          }
        } catch (error) {
          console.warn('⚠️ Perplexity search failed, continuing with local context only:', error);
        }
      }

      // Create clinical reasoning prompt
      const clinicalReasoningPrompt = this.generateClinicalReasoningPrompt(
        symptoms, 
        structuredDiseases, 
        physicianGuidance,
        patientContext,
        perplexityContext
      );

      return {
        elasticsearch_context: elasticsearchContext,
        structured_diseases: structuredDiseases,
        clinical_reasoning_prompt: clinicalReasoningPrompt,
        physician_guidance: physicianGuidance,
        perplexity_context: perplexityContext,
        web_sources: webSources
      };

    } catch (error) {
      console.error('❌ Enhanced RAG search error:', error);
      // Fallback to basic functionality
      const basicContext = await this.baseRAG.searchMedicalContext(symptoms.join(' '));
      return this.convertBasicToPhysicianContext(basicContext, symptoms);
    }
  }

  /**
   * Parse elasticsearch results into structured disease analysis
   */
  private parseElasticsearchResults(
    elasticsearchContext: string, 
    reportedSymptoms: string[]
  ): DiseaseAnalysis[] {
    
    if (!elasticsearchContext || elasticsearchContext.trim() === '') {
      return [];
    }

    const diseases: DiseaseAnalysis[] = [];
    
    // Extract disease information from elasticsearch context
    const diseaseMatches = elasticsearchContext.match(/Condition: ([^\n]+)/g);
    const symptomMatches = elasticsearchContext.match(/Common Symptoms: ([^\n]+)/g);
    const scoreMatches = elasticsearchContext.match(/Relevance Score: ([\d.]+)\/100/g);

    if (diseaseMatches && symptomMatches && scoreMatches) {
      for (let i = 0; i < diseaseMatches.length; i++) {
        const diseaseName = diseaseMatches[i].replace('Condition: ', '').trim();
        const symptoms = symptomMatches[i].replace('Common Symptoms: ', '').split(', ').map(s => s.trim());
        const score = parseFloat(scoreMatches[i].match(/[\d.]+/)?.[0] || '0');
        
        // Calculate symptom overlap
        const overlap = this.calculateSymptomOverlap(reportedSymptoms, symptoms);
        
        diseases.push({
          disease_name: diseaseName,
          symptoms_match: symptoms,
          relevance_score: score,
          symptom_overlap_percentage: overlap
        });
      }
    }

    // Sort by relevance score
    return diseases.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  /**
   * Calculate percentage of symptom overlap between reported and disease symptoms
   */
  private calculateSymptomOverlap(reportedSymptoms: string[], diseaseSymptoms: string[]): number {
    if (reportedSymptoms.length === 0) return 0;
    
    const normalizedReported = reportedSymptoms.map(s => s.toLowerCase().trim());
    const normalizedDisease = diseaseSymptoms.map(s => s.toLowerCase().trim());
    
    let matches = 0;
    for (const reported of normalizedReported) {
      for (const disease of normalizedDisease) {
        if (disease.includes(reported) || reported.includes(disease)) {
          matches++;
          break;
        }
      }
    }
    
    return Math.round((matches / normalizedReported.length) * 100);
  }

  /**
   * Generate physician-specific guidance based on disease analysis
   */
  private generatePhysicianGuidance(
    diseases: DiseaseAnalysis[], 
    symptoms: string[]
  ): PhysicianGuidance {
    
    // Calculate probability weights based on symptom overlap and relevance
    const probabilityWeights: { [disease: string]: number } = {};
    const totalRelevance = diseases.reduce((sum, d) => sum + d.relevance_score, 0);
    
    diseases.forEach(disease => {
      // Weight based on relevance score and symptom overlap
      const baseWeight = totalRelevance > 0 ? (disease.relevance_score / totalRelevance) : 0;
      const overlapBonus = disease.symptom_overlap_percentage / 100;
      probabilityWeights[disease.disease_name] = Math.min(baseWeight * (1 + overlapBonus), 1.0);
    });

    // Generate examination recommendations based on symptoms
    const recommendedExamination = this.generateExaminationRecommendations(symptoms, diseases);
    
    // Identify red flags based on symptoms and diseases
    const redFlags = this.identifyRedFlags(symptoms, diseases);
    
    // Generate clinical decision points
    const decisionPoints = this.generateClinicalDecisionPoints(symptoms, diseases);

    return {
      differential_probability_weights: probabilityWeights,
      recommended_examination: recommendedExamination,
      red_flag_indicators: redFlags,
      clinical_decision_points: decisionPoints
    };
  }

  /**
   * Generate examination recommendations based on symptoms and differential diagnoses
   */
  private generateExaminationRecommendations(
    symptoms: string[], 
    diseases: DiseaseAnalysis[]
  ): string[] {
    
    const recommendations: string[] = [];
    const symptomSet = new Set(symptoms.map(s => s.toLowerCase()));
    
    // Cardiovascular symptoms
    if (this.hasCardiovascularSymptoms(symptomSet)) {
      recommendations.push(
        "ECG de 12 derivações",
        "Ausculta cardíaca em 4 focos",
        "Verificar pulsos periféricos",
        "Avaliar distensão venosa jugular"
      );
    }
    
    // Respiratory symptoms
    if (this.hasRespiratorySymptoms(symptomSet)) {
      recommendations.push(
        "Ausculta pulmonar completa",
        "Avaliação da expansibilidade torácica",
        "Percussão do tórax",
        "Verificar saturação de O2"
      );
    }
    
    // Abdominal symptoms
    if (this.hasAbdominalSymptoms(symptomSet)) {
      recommendations.push(
        "Inspeção abdominal",
        "Palpação superficial e profunda",
        "Percussão abdominal",
        "Ausculta de ruídos hidroaéreos"
      );
    }
    
    // Neurological symptoms
    if (this.hasNeurologicalSymptoms(symptomSet)) {
      recommendations.push(
        "Exame neurológico básico",
        "Avaliação de reflexos",
        "Teste de coordenação",
        "Avaliação do estado mental"
      );
    }

    return recommendations.slice(0, 6); // Limit to 6 most relevant recommendations
  }

  /**
   * Identify red flag indicators based on symptoms and diseases
   */
  private identifyRedFlags(symptoms: string[], diseases: DiseaseAnalysis[]): string[] {
    const redFlags: string[] = [];
    const symptomSet = new Set(symptoms.map(s => s.toLowerCase()));
    
    // Cardiovascular red flags
    if (symptomSet.has('dor no peito') || symptomSet.has('chest pain')) {
      redFlags.push("Avaliar dor torácica: STEMI vs NSTEMI vs dissecção aórtica");
    }
    
    // Respiratory red flags
    if (symptomSet.has('falta de ar') || symptomSet.has('shortness of breath')) {
      redFlags.push("Descartar embolia pulmonar se fatores de risco presentes");
    }
    
    // Neurological red flags
    if (symptomSet.has('dor de cabeça') || symptomSet.has('headache')) {
      redFlags.push("Avaliar sinais de hipertensão intracraniana");
    }
    
    // Abdominal red flags
    if (symptomSet.has('dor abdominal') || symptomSet.has('abdominal pain')) {
      redFlags.push("Descartar abdome agudo cirúrgico");
    }
    
    return redFlags;
  }

  /**
   * Generate clinical decision points
   */
  private generateClinicalDecisionPoints(
    symptoms: string[], 
    diseases: DiseaseAnalysis[]
  ): string[] {
    
    const decisionPoints: string[] = [];
    
    if (diseases.length > 1) {
      const topDiseases = diseases.slice(0, 3);
      
      topDiseases.forEach((disease, index) => {
        if (index < 2) { // Compare top 2 diseases
          decisionPoints.push(
            `Para diferenciar ${disease.disease_name} vs ${topDiseases[index + 1]?.disease_name}: investigar sintomas específicos`
          );
        }
      });
    }
    
    return decisionPoints;
  }

  /**
   * Generate clinical reasoning prompt for physicians
   */
  private generateClinicalReasoningPrompt(
    symptoms: string[],
    diseases: DiseaseAnalysis[],
    guidance: PhysicianGuidance,
    patientContext?: any,
    perplexityContext?: string
  ): string {
    
    return `
## 🩺 CONTEXTO CLÍNICO PARA ANÁLISE MÉDICA

**Sintomas Relatados:** ${symptoms.join(', ')}
${patientContext ? `**Contexto do Paciente:** ${JSON.stringify(patientContext)}` : ''}

### 📊 ANÁLISE DE DOENÇAS RELEVANTES:
${diseases.map((disease, index) => `
**${index + 1}. ${disease.disease_name}**
- Score de relevância: ${disease.relevance_score.toFixed(1)}/100
- Sobreposição de sintomas: ${disease.symptom_overlap_percentage}%
- Sintomas correspondentes: ${disease.symptoms_match.slice(0, 3).join(', ')}
`).join('')}

### 🔍 ORIENTAÇÕES PARA EXAME FÍSICO:
${guidance.recommended_examination.map(exam => `• ${exam}`).join('\n')}

### ⚠️ RED FLAGS A INVESTIGAR:
${guidance.red_flag_indicators.map(flag => `• ${flag}`).join('\n')}

${perplexityContext ? `
### 🌐 INFORMAÇÕES MÉDICAS ATUALIZADAS (Perplexity AI):
${perplexityContext}

**Fonte:** Busca web atual por informações médicas atualizadas
` : ''}

### 🎯 PONTOS DE DECISÃO CLÍNICA:
${guidance.clinical_decision_points.map(point => `• ${point}`).join('\n')}

**INSTRUÇÕES PARA RESPOSTA MÉDICA:**
1. Use estes dados para calcular probabilidades diagnósticas bayesianas
2. Correlacione com achados do exame físico quando relatados
3. Sugira exames complementares baseados nas hipóteses principais
4. Identifique necessidade de referenciamento ou urgência
5. Forneça orientações práticas para o médico
`;
  }

  /**
   * Convert basic context to physician context for fallback
   */
  private convertBasicToPhysicianContext(basicContext: string, symptoms: string[]): PhysicianMedicalContext {
    return {
      elasticsearch_context: basicContext,
      structured_diseases: [],
      clinical_reasoning_prompt: `
## 📚 CONTEXTO MÉDICO BÁSICO:
${basicContext}

**Sintomas:** ${symptoms.join(', ')}

**Modo de fallback ativo** - Usando conhecimento médico geral do LLM.
`,
      physician_guidance: {
        differential_probability_weights: {},
        recommended_examination: ["Exame físico direcionado pelos sintomas"],
        red_flag_indicators: ["Avaliar sinais de alarme"],
        clinical_decision_points: ["Correlacionar sintomas com achados físicos"]
      }
    };
  }

  // Helper methods for symptom categorization
  private hasCardiovascularSymptoms(symptoms: Set<string>): boolean {
    const cardioSymptoms = ['dor no peito', 'chest pain', 'palpitações', 'falta de ar', 'edema', 'shortness of breath'];
    return cardioSymptoms.some(symptom => 
      Array.from(symptoms).some(s => s.includes(symptom))
    );
  }

  private hasRespiratorySymptoms(symptoms: Set<string>): boolean {
    const respSymptoms = ['tosse', 'cough', 'falta de ar', 'shortness of breath', 'chiado'];
    return respSymptoms.some(symptom => 
      Array.from(symptoms).some(s => s.includes(symptom))
    );
  }

  private hasAbdominalSymptoms(symptoms: Set<string>): boolean {
    const abdSymptoms = ['dor abdominal', 'abdominal pain', 'náusea', 'nausea', 'vômito', 'diarreia'];
    return abdSymptoms.some(symptom => 
      Array.from(symptoms).some(s => s.includes(symptom))
    );
  }

  private hasNeurologicalSymptoms(symptoms: Set<string>): boolean {
    const neuroSymptoms = ['dor de cabeça', 'headache', 'tontura', 'fraqueza', 'formigamento'];
    return neuroSymptoms.some(symptom => 
      Array.from(symptoms).some(s => s.includes(symptom))
    );
  }

  /**
   * Backward compatibility: delegate to original RAG
   */
  async searchMedicalContext(userInput: string): Promise<string> {
    return await this.baseRAG.searchMedicalContext(userInput);
  }

  toggleRAG(enabled: boolean): void {
    this.baseRAG.toggleRAG(enabled);
  }

  async enhancePromptWithMedicalContext(userPrompt: string): Promise<string> {
    return await this.baseRAG.enhancePromptWithMedicalContext(userPrompt);
  }
}

// Create enhanced instance
export const enhancedElasticsearchRAG = new EnhancedElasticsearchRAG();