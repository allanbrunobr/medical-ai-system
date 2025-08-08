/**
 * Structured Medical Extractor
 * Extração semântica estruturada de entidades médicas usando IA
 * Baseado no fluxo do test-complete-flow.js
 */

export interface PatientInfo {
  age?: number;
  gender: 'M' | 'F' | 'unknown';
}

export interface MedicalCondition {
  pt: string;           // Condição em português
  en: string;           // Condição em inglês
  mesh?: string;        // MeSH term correspondente
  confidence: number;   // Confiança (0-1)
}

export interface MedicalSymptom {
  pt: string;           // Sintoma em português
  en: string;           // Sintoma em inglês
  severity?: 'mild' | 'moderate' | 'severe';
}

export interface StructuredMedicalEntities {
  patient_info: PatientInfo;
  conditions: MedicalCondition[];
  symptoms: MedicalSymptom[];
  severity: 'mild' | 'moderate' | 'severe';
  english_query: string;        // Query otimizada para busca
  confidence: number;           // Confiança geral (0-1)
  specialty_hint?: string;      // Especialidade médica sugerida
}

export class StructuredMedicalExtractor {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private cache = new Map<string, { result: StructuredMedicalEntities; timestamp: number }>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hora

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ Google AI API key not found - structured extraction will not work');
    } else {
      console.log('✅ Structured Medical Extractor initialized');
    }
  }

  /**
   * Extrai entidades médicas estruturadas de um texto
   */
  async extractStructuredEntities(medicalText: string): Promise<StructuredMedicalEntities | null> {
    if (!this.apiKey || !medicalText.trim()) {
      return null;
    }

    // Check cache first
    const cached = this.getCachedResult(medicalText);
    if (cached) {
      console.log('💾 Using cached structured extraction result');
      return cached;
    }

    try {
      console.log(`🧠 Extracting structured entities from: "${medicalText.substring(0, 100)}..."`);

      const prompt = this.buildExtractionPrompt(medicalText);
      
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
            temperature: 0.1, 
            maxOutputTokens: 1000
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

      const entities = this.parseStructuredResponse(responseText);
      
      if (entities) {
        console.log(`✅ Extracted structured entities:`);
        console.log(`  👤 Patient: ${entities.patient_info.gender}, ${entities.patient_info.age || 'unknown'} anos`);
        console.log(`  🏥 Conditions: ${entities.conditions.map(c => c.pt).join(', ')}`);
        console.log(`  🔍 Symptoms: ${entities.symptoms.map(s => s.pt).join(', ')}`);
        console.log(`  ⚠️ Severity: ${entities.severity}`);
        console.log(`  🇺🇸 Query: "${entities.english_query}"`);
        console.log(`  📊 Confidence: ${(entities.confidence * 100).toFixed(1)}%`);

        // Cache the result
        this.setCachedResult(medicalText, entities);
      }

      return entities;

    } catch (error) {
      console.error('❌ Error in structured extraction:', error);
      return null;
    }
  }

  /**
   * Constrói o prompt para extração estruturada
   */
  private buildExtractionPrompt(medicalText: string): string {
    return `Analise este caso clínico/relato médico e extraia informações estruturadas:

"${medicalText}"

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

REGRAS:
- Extraia APENAS informações explícitas do texto
- Use MeSH terms padrão quando possível
- Query em inglês deve ser otimizada para busca médica
- Confidence baseado na clareza das informações
- Severity baseado na gravidade dos sintomas
- Se informação não estiver clara, use valores padrão apropriados

RESPONDA APENAS COM O JSON, SEM TEXTO ADICIONAL.`;
  }

  /**
   * Faz parsing da resposta da IA
   */
  private parseStructuredResponse(responseText: string): StructuredMedicalEntities | null {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.error('❌ No JSON found in AI response');
        return null;
      }
      
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      // Validate required fields
      if (!parsed.patient_info || !parsed.conditions || !parsed.symptoms) {
        console.error('❌ Invalid JSON structure from AI');
        return null;
      }

      // Normalize and validate data
      const entities: StructuredMedicalEntities = {
        patient_info: {
          age: parsed.patient_info.age || undefined,
          gender: parsed.patient_info.gender || 'unknown'
        },
        conditions: parsed.conditions.map((c: any) => ({
          pt: c.pt || '',
          en: c.en || '',
          mesh: c.mesh || undefined,
          confidence: Math.min(Math.max(c.confidence || 0, 0), 1)
        })),
        symptoms: parsed.symptoms.map((s: any) => ({
          pt: s.pt || '',
          en: s.en || '',
          severity: s.severity || 'moderate'
        })),
        severity: parsed.severity || 'moderate',
        english_query: parsed.english_query || '',
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1),
        specialty_hint: parsed.specialty_hint || undefined
      };

      return entities;

    } catch (error) {
      console.error('❌ Error parsing AI response:', error);
      return null;
    }
  }

  /**
   * Gera query otimizada para busca híbrida
   */
  generateHybridSearchQuery(entities: StructuredMedicalEntities): {
    embedding_text: string;
    elasticsearch_query: string;
    pubmed_query: string;
  } {
    // Texto para embedding (mais descritivo)
    const embeddingParts: string[] = [];
    
    if (entities.patient_info.age) {
      embeddingParts.push(`${entities.patient_info.age} year old`);
    }
    if (entities.patient_info.gender !== 'unknown') {
      embeddingParts.push(`${entities.patient_info.gender === 'M' ? 'male' : 'female'} patient`);
    }
    
    const symptomsEn = entities.symptoms.map(s => s.en).filter(s => s);
    const conditionsEn = entities.conditions.map(c => c.en).filter(c => c);
    
    if (symptomsEn.length > 0) {
      embeddingParts.push(`symptoms: ${symptomsEn.join(', ')}`);
    }
    if (conditionsEn.length > 0) {
      embeddingParts.push(`conditions: ${conditionsEn.join(', ')}`);
    }

    // Query para Elasticsearch (mais específica)
    const elasticsearchQuery = entities.english_query || symptomsEn.join(' ');

    // Query para PubMed com MeSH terms
    const meshTerms = entities.conditions
      .filter(c => c.mesh)
      .map(c => `"${c.mesh}"[MeSH Terms]`)
      .slice(0, 3); // Máximo 3 MeSH terms

    const pubmedQuery = meshTerms.length > 0 
      ? meshTerms.join(' AND ')
      : entities.english_query || elasticsearchQuery;

    return {
      embedding_text: embeddingParts.join('; '),
      elasticsearch_query: elasticsearchQuery,
      pubmed_query: pubmedQuery
    };
  }

  /**
   * Cache management
   */
  private getCachedResult(text: string): StructuredMedicalEntities | null {
    const cached = this.cache.get(text);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }
    this.cache.delete(text);
    return null;
  }

  private setCachedResult(text: string, result: StructuredMedicalEntities): void {
    this.cache.set(text, { result, timestamp: Date.now() });
    
    // Clean old cache entries
    if (this.cache.size > 50) {
      const cutoff = Date.now() - this.CACHE_TTL;
      for (const [key, value] of this.cache.entries()) {
        if (value.timestamp < cutoff) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Verifica se o serviço está disponível
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance
export const structuredMedicalExtractor = new StructuredMedicalExtractor();