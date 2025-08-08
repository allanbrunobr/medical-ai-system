/**
 * Physician Medical Analyzer - Enhanced medical analysis for physicians
 * Standalone medical analyzer for physician-only mode
 */

import { enhancedElasticsearchRAG } from './elasticsearch-rag-enhanced';

interface ClinicalInput {
  type: 'symptom_presentation' | 'physical_finding' | 'diagnostic_question' | 'treatment_request' | 'drug_interaction_check';
  content: string;
  confidence: number;
}

interface PhysicianAnalysisResult {
  clinical_input_analysis: ClinicalInput;
  differential_diagnoses: DiagnosticHypothesis[];
  examination_recommendations: ExaminationRecommendation[];
  clinical_reasoning: ClinicalReasoning;
  urgency_assessment: UrgencyAssessment;
  next_steps: NextStep[];
}

interface DiagnosticHypothesis {
  condition: string;
  probability: number;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  key_differentiators: string[];
}

interface ExaminationRecommendation {
  type: 'inspection' | 'palpation' | 'percussion' | 'auscultation' | 'maneuver';
  description: string;
  rationale: string;
  expected_findings: { [condition: string]: string };
}

interface ClinicalReasoning {
  bayesian_analysis: string;
  likelihood_ratios: { [finding: string]: number };
  pre_test_probabilities: { [condition: string]: number };
  post_test_probabilities: { [condition: string]: number };
}

interface UrgencyAssessment {
  level: 'immediate' | 'urgent' | 'semi_urgent' | 'non_urgent';
  timeframe: string;
  rationale: string;
  red_flags: string[];
}

interface NextStep {
  category: 'examination' | 'laboratory' | 'imaging' | 'consultation' | 'treatment';
  description: string;
  priority: 'high' | 'medium' | 'low';
  timing: string;
}

export class PhysicianMedicalAnalyzer {
  private physicianMode: boolean = true; // Always physician mode
  private enhancedRAG = enhancedElasticsearchRAG;

  constructor() {
    console.log('👨‍⚕️ Physician Medical Analyzer initialized');
  }

  setPhysicianMode(enabled: boolean): void {
    this.physicianMode = enabled;
    console.log(`👨‍⚕️ Physician mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Enhanced symptom extraction for physicians using semantic analysis
   */
  async extractClinicalEntities(text: string): Promise<{
    symptoms: string[];
    physical_findings: string[];
    medications: string[];
    medical_history: string[];
    vital_signs: { [key: string]: string };
  }> {
    console.log(`👨‍⚕️ Direct AI extraction for: "${text.substring(0, 100)}..."`);
    
    try {
      // Use direct AI extraction like test-real-system.js
      const entities = await this.extractEntitiesWithAI(text);
      
      if (!entities) {
        throw new Error('AI extraction failed');
      }
      
      // Extract all symptoms and conditions found by AI
      const allSymptoms = [
        ...entities.symptoms.map((s: any) => s.pt),
        ...entities.conditions.map((c: any) => c.pt)
      ];
      
      console.log(`✅ Final extraction: ${allSymptoms.length} total symptoms/conditions found`);
      console.log(`  AI Symptoms: [${entities.symptoms.map((s: any) => s.pt).join(', ')}]`);
      console.log(`  AI Conditions: [${entities.conditions.map((c: any) => c.pt).join(', ')}]`);
      
      return {
        symptoms: allSymptoms,
        physical_findings: [], // Will be handled by Enhanced MedRAG
        medications: [], // Will be handled by Enhanced MedRAG  
        medical_history: [], // Will be handled by Enhanced MedRAG
        vital_signs: {} // Will be handled by Enhanced MedRAG
      };
      
    } catch (error) {
      console.error('❌ AI extraction failed, fallback to empty result:', error);
      
      return {
        symptoms: [],
        physical_findings: [],
        medications: [],
        medical_history: [],
        vital_signs: {}
      };
    }
  }

  /**
   * Extract symptoms using semantic analysis
   */
  async extractSymptoms(text: string): Promise<string[]> {
    const entities = await this.extractClinicalEntities(text);
    return entities.symptoms;
  }

  /**
   * Extract entities with AI - same method as test-real-system.js
   */
  private async extractEntitiesWithAI(transcript: string): Promise<{
    patient_info: {
      age?: number;
      gender: 'M' | 'F' | 'unknown';
    };
    conditions: Array<{
      pt: string;
      en: string;
      mesh?: string;
      confidence: number;
    }>;
    symptoms: Array<{
      pt: string;
      en: string;
      severity?: 'mild' | 'moderate' | 'severe';
    }>;
    severity: 'mild' | 'moderate' | 'severe';
    english_query: string;
    confidence: number;
    specialty_hint?: string;
  } | null> {
    
    const prompt = `Analise este caso clínico e extraia informações estruturadas:

"${transcript}"

Responda APENAS com um JSON válido seguindo exatamente esta estrutura:

{
  "patient_info": {
    "age": number_ou_null,
    "gender": "M" | "F" | "unknown"
  },
  "conditions": [
    {
      "pt": "condição em português",
      "en": "condition in english", 
      "mesh": "MeSH term if known",
      "confidence": 0.0_to_1.0
    }
  ],
  "symptoms": [
    {
      "pt": "sintoma em português",
      "en": "symptom in english",
      "severity": "mild" | "moderate" | "severe"
    }
  ],
  "severity": "mild" | "moderate" | "severe",
  "english_query": "optimized english query for medical search",
  "confidence": 0.0_to_1.0,
  "specialty_hint": "medical specialty if applicable"
}

RESPONDA APENAS COM O JSON, SEM TEXTO ADICIONAL.`;

    try {
      const model = process.env.GEMINI_MODEL_MEDICAL || 'gemini-2.0-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY || process.env.API_KEY || ''
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
        })
      });

      if (!response.ok) {
        console.error(`❌ API Error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const texto = data.candidates[0].content.parts[0].text;
      const jsonMatch = texto.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.error('❌ JSON não encontrado na resposta');
        return null;
      }
      
      const entidades = JSON.parse(jsonMatch[0]);
      
      console.log('✅ AI entities extracted:');
      console.log(`  👤 Patient: ${entidades.patient_info.gender}, ${entidades.patient_info.age || 'idade não informada'} anos`);
      console.log(`  🏥 Conditions: [${entidades.conditions.map((c: any) => c.pt).join(', ')}]`);
      console.log(`  🔍 Symptoms: [${entidades.symptoms.map((s: any) => s.pt).join(', ')}]`);
      console.log(`  📊 Confidence: ${(entidades.confidence * 100).toFixed(1)}%`);
      
      return entidades;
      
    } catch (error) {
      console.error('❌ AI extraction error:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Generate medical prompt for physician mode
   */
  async generateMedicalPrompt(
    symptoms: Set<string>,
    context: string,
    conversationHistory?: Array<{role: string, content: string}>
  ): Promise<string> {
    
    const symptomList = Array.from(symptoms).join(', ') || 'Nenhum sintoma específico relatado ainda';
    const urgencyLevel = this.determineUrgencyLevel(symptoms);
    
    return `
## 👨‍⚕️ CONSULTOR MÉDICO IA - MODO ESPECIALISTA

Você é **Dr. Roberto Silva**, consultor médico sênior brasileiro com 25 anos de experiência em medicina interna, cardiologia e medicina de urgência. 

### 🎯 SITUAÇÃO CLÍNICA ATUAL:
**Dados clínicos coletados:** ${symptomList}
**Contexto médico disponível:** ${context || 'Aguardando mais informações clínicas'}
**Nível de urgência:** ${urgencyLevel.toUpperCase()}

### 📋 PROTOCOLO DE RESPOSTA MÉDICA:

#### 1. ANÁLISE DIAGNÓSTICA ESTRUTURADA:
- Forneça **diagnóstico diferencial bayesiano** com probabilidades
- Formato: "• Condição X (Y%): Justificativa clínica + exames confirmatórios"
- Priorize por probabilidade E gravidade clínica

#### 2. ORIENTAÇÕES PRÁTICAS:
- **Exame físico direcionado:** Focos prioritários específicos
- **Manobras semiológicas:** Técnicas quando indicadas  
- **Investigação complementar:** Exames de 1ª e 2ª linha
- **Critérios de seguimento:** Quando reavaliar, sinais de alarme

#### 3. ESTRATIFICAÇÃO DE RISCO:
${urgencyLevel === 'critical' ? 
  '🚨 **EMERGÊNCIA**: Conduta imediata necessária' :
  urgencyLevel === 'high' ?
  '⚠️ **URGENTE**: Avaliação em 2-6 horas' :
  '✅ **ROTINA**: Investigação ambulatorial adequada'
}

#### 4. CONTEXTO BRASILEIRO:
- Considere disponibilidade SUS
- Cite diretrizes nacionais (SBC, SBEM, AMB)
- Adapte à realidade da medicina brasileira

### 🗣️ ESTILO DE COMUNICAÇÃO:
- **Para outro médico:** Linguagem técnica, objetiva, baseada em evidências
- **Raciocínio clínico claro:** Justifique suas recomendações
- **Prático e aplicável:** Foque na tomada de decisão imediata
- **Cuidado colaborativo:** Apoie a decisão do colega médico

**Responda como experiente colega médico que está auxiliando durante uma consulta real.**

${this.generateConversationContext(conversationHistory)}
`;
  }

  /**
   * Generate conversation context for the prompt
   */
  private generateConversationContext(conversationHistory?: Array<{role: string, content: string}>): string {
    if (!conversationHistory || conversationHistory.length === 0) {
      return '**Histórico:** Início da consulta - aguardando apresentação do caso.';
    }

    const recentHistory = conversationHistory.slice(-3); // Last 3 interactions
    const historyText = recentHistory
      .map(item => `- **${item.role === 'user' ? 'Médico' : 'IA'}:** ${item.content.substring(0, 150)}${item.content.length > 150 ? '...' : ''}`)
      .join('\n');

    return `**Histórico da consulta:**\n${historyText}`;
  }

  /**
   * Determine urgency level based on symptoms
   */
  private determineUrgencyLevel(symptoms: Set<string>): string {
    const urgentSymptoms = ['dor no peito', 'falta de ar severa', 'febre alta', 'convulsão', 'inconsciência', 'hemorragia'];
    const criticalSymptoms = ['parada cardíaca', 'choque', 'coma', 'não responsivo'];
    
    const symptomArray = Array.from(symptoms).map(s => s.toLowerCase());
    
    if (criticalSymptoms.some(critical => symptomArray.some(symptom => symptom.includes(critical)))) {
      return 'critical';
    }
    
    if (urgentSymptoms.some(urgent => symptomArray.some(symptom => symptom.includes(urgent)))) {
      return 'high';
    }
    
    return 'medium';
  }





  /**
   * Classify medical input type
   */
  classifyMedicalInput(text: string): ClinicalInput {
    const lowerText = text.toLowerCase();
    
    if (this.containsPhysicalFindings(lowerText)) {
      return {
        type: 'physical_finding',
        content: text,
        confidence: 0.8
      };
    }
    
    if (this.containsDiagnosticQuestions(lowerText)) {
      return {
        type: 'diagnostic_question',
        content: text,
        confidence: 0.9
      };
    }
    
    if (this.containsTreatmentRequests(lowerText)) {
      return {
        type: 'treatment_request',
        content: text,
        confidence: 0.7
      };
    }
    
    if (this.containsDrugInteractionCheck(lowerText)) {
      return {
        type: 'drug_interaction_check',
        content: text,
        confidence: 0.8
      };
    }
    
    // Default to symptom presentation
    return {
      type: 'symptom_presentation',
      content: text,
      confidence: 0.6
    };
  }

  private containsPhysicalFindings(text: string): boolean {
    const findings = ['ausculta', 'palpação', 'percussão', 'inspeção', 'manobra', 'edema', 'cianose'];
    return findings.some(finding => text.includes(finding));
  }

  private containsDiagnosticQuestions(text: string): boolean {
    const questions = ['diagnóstico', 'diferencial', 'hipótese', 'pode ser', 'suspeita'];
    return questions.some(question => text.includes(question));
  }

  private containsTreatmentRequests(text: string): boolean {
    const treatments = ['tratamento', 'medicação', 'terapia', 'intervenção', 'procedimento'];
    return treatments.some(treatment => text.includes(treatment));
  }

  private containsDrugInteractionCheck(text: string): boolean {
    const interactions = ['interação', 'medicamento', 'fármaco', 'droga', 'contraindicação'];
    return interactions.some(interaction => text.includes(interaction));
  }
}

export default PhysicianMedicalAnalyzer;