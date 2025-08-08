/**
 * Google Embeddings Service
 * Gera embeddings semânticos usando Google Generative AI
 */

interface EmbeddingResponse {
  embedding: {
    values: number[];
  };
}

export class GoogleEmbeddingsService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private cache = new Map<string, { embedding: number[]; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

  constructor() {
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ Google AI API key not found - embeddings will not work');
    } else {
      console.log('✅ Google Embeddings Service initialized');
    }
  }

  /**
   * Gera embedding para um texto médico
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.apiKey || !text.trim()) {
      return null;
    }

    // Check cache first
    const cached = this.getCachedEmbedding(text);
    if (cached) {
      console.log('💾 Using cached embedding');
      return cached;
    }

    try {
      console.log(`🧠 Generating embedding for: "${text.substring(0, 100)}..."`);

      const response = await fetch(`${this.baseUrl}/models/embedding-001:embedContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify({
          model: 'models/embedding-001',
          content: {
            parts: [{ text }]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Google Embeddings API error: ${response.status}`);
      }

      const data: EmbeddingResponse = await response.json();
      const embedding = data.embedding?.values;

      if (!embedding || embedding.length === 0) {
        throw new Error('No embedding returned from API');
      }

      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);

      // Cache the result
      this.setCachedEmbedding(text, embedding);

      return embedding;

    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Prepara texto médico para embedding
   */
  prepareMedicalText(
    symptoms: string[], 
    conditions: string[], 
    patientInfo?: { age?: number; gender?: string }
  ): string {
    const parts: string[] = [];

    if (patientInfo) {
      if (patientInfo.age) parts.push(`age ${patientInfo.age}`);
      if (patientInfo.gender) parts.push(`${patientInfo.gender} patient`);
    }

    if (symptoms.length > 0) {
      parts.push(`symptoms: ${symptoms.join(', ')}`);
    }

    if (conditions.length > 0) {
      parts.push(`conditions: ${conditions.join(', ')}`);
    }

    const text = parts.join('; ');
    console.log(`📝 Prepared medical text for embedding: "${text}"`);
    
    return text;
  }

  /**
   * Cache management
   */
  private getCachedEmbedding(text: string): number[] | null {
    const cached = this.cache.get(text);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.embedding;
    }
    this.cache.delete(text);
    return null;
  }

  private setCachedEmbedding(text: string, embedding: number[]): void {
    this.cache.set(text, { embedding, timestamp: Date.now() });
    
    // Clean old cache entries periodically
    if (this.cache.size > 100) {
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
export const googleEmbeddings = new GoogleEmbeddingsService();