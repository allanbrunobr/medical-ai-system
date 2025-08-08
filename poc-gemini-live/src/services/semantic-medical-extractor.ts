/**
 * Semantic Medical Extractor
 * Replaces hardcoded keywords with intelligent semantic extraction
 * Uses medical translation service for accurate PT→EN conversion
 */

import { medicalTranslationService } from './medical-translation-service';

interface ExtractedMedicalEntities {
  symptoms: string[];
  conditions: string[];
  anatomical_regions: string[];
  procedures: string[];
  medications: string[];
  vital_signs: { [key: string]: string };
  translated_terms: string[];
  confidence: number;
}

export class SemanticMedicalExtractor {
  constructor() {
    // Pure semantic mode - no hardcoded patterns
  }

  /**
   * Extract medical entities from Portuguese text using semantic analysis
   */
  async extractMedicalEntities(text: string): Promise<ExtractedMedicalEntities> {
    try {
      // Step 1: Detect if text contains medical content using semantic similarity
      const isMedicalContext = await this.detectMedicalContext(text);
      
      if (!isMedicalContext) {
        return this.createEmptyResult();
      }

      // Step 2: Extract entities using semantic similarity search
      const entities = await this.extractUsingSemanticSearch(text);
      
      // Step 3: Translate to English for searches
      const translationResult = await medicalTranslationService.translatePTtoEN(text);
      
      // Step 4: Combine results with translation
      const allSymptoms = [...new Set([...entities.symptoms, ...entities.conditions])];
      const allConditions = [...new Set(entities.conditions)];
      
      const result: ExtractedMedicalEntities = {
        symptoms: allSymptoms,
        conditions: allConditions,
        anatomical_regions: entities.anatomical_regions,
        procedures: entities.procedures,
        medications: entities.medications,
        vital_signs: entities.vital_signs,
        translated_terms: translationResult.translated_terms,
        confidence: Math.min(entities.confidence, translationResult.confidence)
      };

      return result;

    } catch (error) {
      console.error('Medical extraction error:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * Detect if text contains medical context using intelligent semantic search
   */
  private async detectMedicalContext(text: string): Promise<boolean> {
    try {
      // Use bilingual Elasticsearch to check if text has medical similarity
      const { bilingualElasticsearchRAG } = await import('./bilingual-elasticsearch-rag');
      
      // Quick test search to see if text matches medical content
      const result = await bilingualElasticsearchRAG.searchMedicalContext(text, {
        max_results: 1,
        min_score: 0.1
      });
      
      // If Elasticsearch returns no results but we have good translations, assume medical
      const hasTranslations = result.translation_info.translated_terms.length > 0;
      const translationConfidence = result.translation_info.confidence;
      
      const isMedical = result.confidence > 0.1 || (hasTranslations && translationConfidence > 0.5);
      
      return isMedical;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract entities using semantic similarity search in Elasticsearch + AI classification
   */
  private async extractUsingSemanticSearch(text: string): Promise<{
    symptoms: string[];
    conditions: string[];
    anatomical_regions: string[];
    procedures: string[];
    medications: string[];
    vital_signs: { [key: string]: string };
    confidence: number;
  }> {
    try {
      // Use bilingual Elasticsearch to find medical similarities
      const { bilingualElasticsearchRAG } = await import('./bilingual-elasticsearch-rag');
      
      const searchResult = await bilingualElasticsearchRAG.searchMedicalContext(text, {
        max_results: 5,
        min_score: 0.1
      });
      
      const extractedEntities = {
        symptoms: [] as string[],
        conditions: [] as string[],
        anatomical_regions: [] as string[],
        procedures: [] as string[],
        medications: [] as string[],
        vital_signs: {} as { [key: string]: string },
        confidence: searchResult.confidence
      };
      
      // Extract medical terms from translation info - this is where the medical terms are detected
      if (searchResult.translation_info.original_terms.length > 0) {
        // Use AI to classify detected medical terms (no hardcoded patterns)
        const classificationResult = await this.classifyMedicalTermsWithAI(
          searchResult.translation_info.original_terms,
          searchResult.translation_info.translated_terms
        );
        
        if (classificationResult) {
          extractedEntities.symptoms = classificationResult.symptoms;
          extractedEntities.conditions = classificationResult.conditions;
          extractedEntities.procedures = classificationResult.procedures;
          extractedEntities.medications = classificationResult.medications;
        } else {
          // Fallback: treat all detected medical terms as symptoms to ensure Enhanced MedRAG triggers
          extractedEntities.symptoms = [...searchResult.translation_info.original_terms];
        }
        
        extractedEntities.confidence = searchResult.translation_info.confidence;
      }
      
      // Extract from search results for additional context
      if (searchResult.sources && searchResult.sources.length > 0) {
        extractedEntities.confidence = Math.max(extractedEntities.confidence, searchResult.confidence);
      }
      
      // Also extract vital signs from original text
      this.extractVitalSigns(text, extractedEntities.vital_signs);
      
      return extractedEntities;
      
    } catch (error) {
      return this.createEmptyEntitiesResult();
    }
  }

  /**
   * Create empty entities result for failed extractions
   */
  private createEmptyEntitiesResult(): {
    symptoms: string[];
    conditions: string[];
    anatomical_regions: string[];
    procedures: string[];
    medications: string[];
    vital_signs: { [key: string]: string };
    confidence: number;
  } {
    return {
      symptoms: [],
      conditions: [],
      anatomical_regions: [],
      procedures: [],
      medications: [],
      vital_signs: {},
      confidence: 0
    };
  }

  /**
   * Classify medical terms using AI (no hardcoded patterns)
   */
  private async classifyMedicalTermsWithAI(
    originalTerms: string[], 
    translatedTerms: string[]
  ): Promise<{
    symptoms: string[];
    conditions: string[];
    procedures: string[];
    medications: string[];
  } | null> {
    try {
      const prompt = `Classifique os seguintes termos médicos nas categorias apropriadas. Responda APENAS com um JSON válido:

TERMOS PARA CLASSIFICAR:
${originalTerms.map((term, i) => `- "${term}" (EN: "${translatedTerms[i] || term}")`).join('\n')}

Responda com este formato JSON exato:
{
  "symptoms": ["termo1", "termo2"],
  "conditions": ["termo3", "termo4"], 
  "procedures": ["termo5"],
  "medications": ["termo6"]
}

REGRAS:
- symptoms: manifestações clínicas, sinais, sintomas (ex: dispneia, edema, dor)
- conditions: doenças, diagnósticos, estados patológicos (ex: diabetes, insuficiência cardíaca)
- procedures: procedimentos médicos, exames, cirurgias
- medications: medicamentos, fármacos
- Use APENAS os termos fornecidos
- Se um termo não se encaixar claramente, coloque em "symptoms"
- RESPONDA APENAS COM O JSON, SEM TEXTO ADICIONAL`;

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('Google AI API key not configured');
      }

      const model = process.env.GEMINI_MODEL_MEDICAL || 'gemini-2.0-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
        })
      });

      if (!response.ok) {
        throw new Error(`AI API Error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const classification = JSON.parse(jsonMatch[0]);
      
      return classification;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract vital signs using semantic analysis
   * Future implementation could use AI to extract vital signs semantically
   */
  private extractVitalSigns(_text: string, _vitalSigns: { [key: string]: string }): void {
    // TODO: Implement semantic vital signs extraction using AI
    // For now, let the medical translation service handle vital signs detection
    // Removed verbose logging to avoid UI interference
  }


  /**
   * Create empty result for non-medical text
   */
  private createEmptyResult(): ExtractedMedicalEntities {
    return {
      symptoms: [],
      conditions: [],
      anatomical_regions: [],
      procedures: [],
      medications: [],
      vital_signs: {},
      translated_terms: [],
      confidence: 0
    };
  }

  /**
   * Get extractor statistics
   */
  getStats(): {
    mode: string;
    semantic_enabled: boolean;
    translation_enabled: boolean;
  } {
    return {
      mode: 'pure_semantic',
      semantic_enabled: true,
      translation_enabled: true
    };
  }
}

export const semanticMedicalExtractor = new SemanticMedicalExtractor();