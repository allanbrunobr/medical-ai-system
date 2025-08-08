/**
 * Medical Translation Service
 * Handles precise PT↔EN translation for medical terminology
 * Ensures clinical accuracy for Elasticsearch and PubMed searches
 */

interface MedicalTerm {
  portuguese: string;
  english: string;
  mesh_term?: string;
  snomed_code?: string;
  category: 'symptom' | 'condition' | 'anatomy' | 'procedure' | 'medication';
}

interface TranslationResult {
  translated_terms: string[];
  original_terms: string[];
  confidence: number;
  fallback_used: boolean;
}

export class MedicalTranslationService {
  private medicalDictionary: Map<string, MedicalTerm> = new Map();
  private cache: Map<string, TranslationResult> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.initializeMedicalDictionary();
    console.log('🌐 Medical Translation Service initialized');
  }

  /**
   * Translate Portuguese medical text to English for searches
   */
  async translatePTtoEN(portugueseText: string): Promise<TranslationResult> {
    const cacheKey = `pt_en_${portugueseText.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      console.log('💾 Using cached PT→EN translation');
      return cached;
    }

    console.log(`🌐 Translating PT→EN: "${portugueseText}"`);
    
    try {
      const translatedTerms: string[] = [];
      const originalTerms: string[] = [];
      let confidence = 0.8;
      let fallbackUsed = false;

      // Extract medical terms using AI
      const medicalTerms = await this.extractMedicalTerms(portugueseText);
      
      for (const term of medicalTerms) {
        const normalizedTerm = this.normalizeTerm(term);
        const medicalTerm = this.medicalDictionary.get(normalizedTerm);
        
        if (medicalTerm) {
          translatedTerms.push(medicalTerm.english);
          originalTerms.push(term);
          console.log(`✅ Dictionary: "${term}" → "${medicalTerm.english}"`);
        } else {
          // Fallback to pattern-based translation
          const fallbackTranslation = this.fallbackTranslation(term);
          if (fallbackTranslation) {
            translatedTerms.push(fallbackTranslation);
            originalTerms.push(term);
            fallbackUsed = true;
            confidence *= 0.7; // Lower confidence for fallback
            console.log(`⚠️ Fallback: "${term}" → "${fallbackTranslation}"`);
          }
        }
      }

      const result: TranslationResult = {
        translated_terms: translatedTerms,
        original_terms: originalTerms,
        confidence,
        fallback_used: fallbackUsed
      };

      // Cache the result
      this.cache.set(cacheKey, result);
      
      console.log(`🎯 PT→EN Translation completed: ${originalTerms.length} terms found`);
      return result;

    } catch (error) {
      console.error('❌ PT→EN translation error:', error);
      return {
        translated_terms: [],
        original_terms: [],
        confidence: 0,
        fallback_used: true
      };
    }
  }

  /**
   * Translate English medical results back to Portuguese
   */
  async translateENtoPT(englishText: string): Promise<string> {
    const cacheKey = `en_pt_${englishText.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && typeof cached === 'string') {
      return cached as any;
    }

    console.log(`🌐 Translating EN→PT: "${englishText.substring(0, 100)}..."`);

    try {
      let translatedText = englishText;

      // Translate using reverse dictionary lookup
      for (const [, medicalTerm] of this.medicalDictionary) {
        const englishTerm = medicalTerm.english.toLowerCase();
        const portugueseTerm = medicalTerm.portuguese;
        
        // Case-insensitive replacement
        const regex = new RegExp(`\\b${englishTerm}\\b`, 'gi');
        translatedText = translatedText.replace(regex, portugueseTerm);
      }

      // Cache result
      this.cache.set(cacheKey, translatedText as any);
      
      console.log(`✅ EN→PT Translation completed`);
      return translatedText;

    } catch (error) {
      console.error('❌ EN→PT translation error:', error);
      return englishText; // Return original if translation fails
    }
  }

  /**
   * Extract medical terms from Portuguese text using AI
   */
  private async extractMedicalTerms(text: string): Promise<string[]> {
    try {
      console.log(`🤖 Using AI to extract medical terms from: "${text}"`);

      const prompt = `Analise o texto médico em português e extraia APENAS os termos médicos específicos (sintomas, condições, procedimentos, medicamentos, anatomia). 

Texto: "${text}"

Retorne uma lista simples separada por vírgulas, sem explicações. Exemplos de termos válidos:
- Sintomas: dispneia, edema, dor no peito, febre
- Condições: diabetes, hipertensão, insuficiência cardíaca
- Procedimentos: ecocardiograma, tomografia
- Anatomia: membros inferiores, tórax

Se não encontrar termos médicos, retorne "NENHUM".`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 200
          }
        })
      });

      if (!response.ok) {
        console.error(`❌ AI medical extraction API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      if (aiResponse === 'NENHUM' || !aiResponse) {
        console.log('🤖 AI found no medical terms');
        return [];
      }

      // Parse AI response
      const extractedTerms = aiResponse
        .split(',')
        .map((term: string) => term.trim().toLowerCase())
        .filter((term: string) => term.length > 2 && !term.includes('nenhum'));

      console.log(`🎯 AI extracted ${extractedTerms.length} medical terms: ${extractedTerms.join(', ')}`);
      return extractedTerms;

    } catch (error) {
      console.error('❌ AI medical extraction error:', error);
      return [];
    }
  }

  /**
   * Normalize medical terms for dictionary lookup
   */
  private normalizeTerm(term: string): string {
    return term.toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove accents
  }

  /**
   * Fallback translation using pattern matching
   */
  private fallbackTranslation(term: string): string | null {
    const patterns: { [key: string]: string } = {
      'dor': 'pain',
      'febre': 'fever',
      'tosse': 'cough',
      'náusea': 'nausea',
      'vômito': 'vomiting',
      'edema': 'edema',
      'inchaço': 'swelling',
      'inchado': 'swollen',
      'respiratória': 'respiratory',
      'respiratório': 'respiratory',
      'cardíaca': 'cardiac',
      'cardíaco': 'cardiac',
      'pulmonar': 'pulmonary',
      'renal': 'renal',
      'hepática': 'hepatic',
      'hepático': 'hepatic'
    };

    for (const [pt, en] of Object.entries(patterns)) {
      if (term.includes(pt)) {
        return term.replace(pt, en);
      }
    }

    return null;
  }

  /**
   * Initialize comprehensive medical dictionary
   */
  private initializeMedicalDictionary(): void {
    const medicalTerms: MedicalTerm[] = [
      // Respiratory symptoms
      { portuguese: 'insuficiência respiratória', english: 'respiratory failure', category: 'symptom' },
      { portuguese: 'falta de ar', english: 'shortness of breath', category: 'symptom' },
      { portuguese: 'dispneia', english: 'dyspnea', category: 'symptom' },
      { portuguese: 'taquipneia', english: 'tachypnea', category: 'symptom' },
      { portuguese: 'bradipneia', english: 'bradypnea', category: 'symptom' },
      { portuguese: 'tosse', english: 'cough', category: 'symptom' },
      { portuguese: 'hemoptise', english: 'hemoptysis', category: 'symptom' },

      // Cardiovascular symptoms
      { portuguese: 'dor no peito', english: 'chest pain', category: 'symptom' },
      { portuguese: 'taquicardia', english: 'tachycardia', category: 'symptom' },
      { portuguese: 'bradicardia', english: 'bradycardia', category: 'symptom' },
      { portuguese: 'hipertensão', english: 'hypertension', category: 'condition' },
      { portuguese: 'hipotensão', english: 'hypotension', category: 'condition' },
      { portuguese: 'síncope', english: 'syncope', category: 'symptom' },
      { portuguese: 'pré-síncope', english: 'presyncope', category: 'symptom' },

      // Edema and swelling
      { portuguese: 'edema', english: 'edema', category: 'symptom' },
      { portuguese: 'inchaço', english: 'swelling', category: 'symptom' },
      { portuguese: 'inchado', english: 'swollen', category: 'symptom' },
      { portuguese: 'membros inferiores inchados', english: 'lower extremity edema', category: 'symptom' },
      { portuguese: 'edema de membros inferiores', english: 'lower limb edema', category: 'symptom' },

      // Neurological symptoms
      { portuguese: 'cefaleia', english: 'headache', category: 'symptom' },
      { portuguese: 'dor de cabeça', english: 'headache', category: 'symptom' },
      { portuguese: 'enxaqueca', english: 'migraine', category: 'condition' },
      { portuguese: 'vertigem', english: 'vertigo', category: 'symptom' },
      { portuguese: 'tontura', english: 'dizziness', category: 'symptom' },
      { portuguese: 'parestesia', english: 'paresthesia', category: 'symptom' },
      { portuguese: 'dormência', english: 'numbness', category: 'symptom' },
      { portuguese: 'formigamento', english: 'tingling', category: 'symptom' },

      // Gastrointestinal symptoms
      { portuguese: 'náusea', english: 'nausea', category: 'symptom' },
      { portuguese: 'vômito', english: 'vomiting', category: 'symptom' },
      { portuguese: 'diarreia', english: 'diarrhea', category: 'symptom' },
      { portuguese: 'constipação', english: 'constipation', category: 'symptom' },
      { portuguese: 'dor abdominal', english: 'abdominal pain', category: 'symptom' },
      { portuguese: 'melena', english: 'melena', category: 'symptom' },
      { portuguese: 'hematêmese', english: 'hematemesis', category: 'symptom' },

      // General symptoms
      { portuguese: 'febre', english: 'fever', category: 'symptom' },
      { portuguese: 'fadiga', english: 'fatigue', category: 'symptom' },
      { portuguese: 'fraqueza', english: 'weakness', category: 'symptom' },
      { portuguese: 'mal estar', english: 'malaise', category: 'symptom' },
      { portuguese: 'calafrio', english: 'chills', category: 'symptom' },

      // Physical findings
      { portuguese: 'cianose', english: 'cyanosis', category: 'symptom' },
      { portuguese: 'palidez', english: 'pallor', category: 'symptom' },
      { portuguese: 'icterícia', english: 'jaundice', category: 'symptom' },

      // Musculoskeletal
      { portuguese: 'artralgia', english: 'arthralgia', category: 'symptom' },
      { portuguese: 'mialgia', english: 'myalgia', category: 'symptom' },
      { portuguese: 'lombalgia', english: 'lower back pain', category: 'symptom' },

      // Urinary symptoms
      { portuguese: 'disúria', english: 'dysuria', category: 'symptom' },
      { portuguese: 'polaciúria', english: 'pollakiuria', category: 'symptom' },
      { portuguese: 'urgência miccional', english: 'urinary urgency', category: 'symptom' },
      { portuguese: 'nictúria', english: 'nocturia', category: 'symptom' }
    ];

    // Populate the dictionary
    medicalTerms.forEach(term => {
      this.medicalDictionary.set(this.normalizeTerm(term.portuguese), term);
    });

    console.log(`📚 Medical dictionary initialized with ${medicalTerms.length} terms`);
  }

  /**
   * Get translation statistics
   */
  getStats(): {
    dictionary_size: number;
    cache_size: number;
    categories: { [key: string]: number };
  } {
    const categories: { [key: string]: number } = {};
    
    for (const [, term] of this.medicalDictionary) {
      categories[term.category] = (categories[term.category] || 0) + 1;
    }

    return {
      dictionary_size: this.medicalDictionary.size,
      cache_size: this.cache.size,
      categories
    };
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Translation cache cleared');
  }
}

export const medicalTranslationService = new MedicalTranslationService();