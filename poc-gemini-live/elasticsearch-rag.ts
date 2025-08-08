/**
 * Elasticsearch RAG integration for Gemini Live
 * Adds medical knowledge search without changing the original interface
 */

interface ElasticsearchHit {
  _source: {
    Disease: string;
    [key: string]: string; // Symptom_1, Symptom_2, etc.
  };
  _score: number;
}

export class ElasticsearchRAG {
  private elasticsearchUrl: string;
  private apiKey: string;
  private enabled: boolean = true;

  constructor() {
    // Use environment variables or fallback to direct Elasticsearch URL 
    this.elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'https://3d6ee28c63cb47b8b8ee7ca0e3a82897.us-central1.gcp.cloud.es.io:443';
    this.apiKey = process.env.ELASTICSEARCH_API_KEY || 'aTlGR0FaZ0IzenpOYnZndmVwdWE6YThHNmZ4Zi1JOWRNcGtVZDNsM2pNZw==';
    
    console.log('🔍 Elasticsearch RAG initialized with URL from environment');
  }

  /**
   * Search for medical information based on user input
   */
  async searchMedicalContext(userInput: string): Promise<string> {
    if (!this.enabled || !userInput.trim()) {
      return '';
    }

    try {
      console.log(`🔍 Searching Elasticsearch for: "${userInput}"`);
      
      const searchBody = {
        size: 3, // Top 3 results for context
        query: {
          bool: {
            should: [
              // Search in Disease field
              {
                match: {
                  Disease: {
                    query: userInput,
                    fuzziness: 'AUTO',
                    boost: 2.0
                  }
                }
              },
              // Search in all symptom fields
              ...Array.from({ length: 12 }, (_, i) => ({
                match: {
                  [`Symptom_${i + 1}`]: {
                    query: userInput,
                    fuzziness: 'AUTO'
                  }
                }
              }))
            ],
            minimum_should_match: 1
          }
        }
      };

      const response = await fetch(`${this.elasticsearchUrl}/search-medical-2/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${this.apiKey}`
        },
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        console.error(`Elasticsearch error: ${response.status}`);
        return '';
      }

      const data = await response.json();
      const hits = data.hits.hits as ElasticsearchHit[];

      if (hits.length === 0) {
        return '';
      }

      // Format results as context
      const context = this.formatMedicalContext(hits);
      console.log(`✅ Found ${hits.length} medical references`);
      
      return context;

    } catch (error) {
      console.error('Elasticsearch error:', error);
      return '';
    }
  }

  /**
   * Format search results as medical context
   */
  private formatMedicalContext(hits: ElasticsearchHit[]): string {
    const contexts = hits.map((hit, index) => {
      const source = hit._source;
      const symptoms = [];
      
      // Collect all symptoms
      for (let i = 1; i <= 12; i++) {
        const symptom = source[`Symptom_${i}`];
        if (symptom && symptom.trim()) {
          symptoms.push(symptom.trim());
        }
      }

      return `
Medical Reference ${index + 1}:
Condition: ${source.Disease}
Common Symptoms: ${symptoms.slice(0, 5).join(', ')}
Relevance Score: ${(hit._score * 10).toFixed(1)}/100`;
    }).join('\n');

    return `
[MEDICAL KNOWLEDGE BASE]
${contexts}

Note: This information is for educational purposes only. Always consult a healthcare professional for medical advice.
`;
  }

  /**
   * Enhanced prompt with medical context
   */
  async enhancePromptWithMedicalContext(userPrompt: string): Promise<string> {
    const medicalContext = await this.searchMedicalContext(userPrompt);
    
    if (!medicalContext) {
      return userPrompt;
    }

    // Add context to the prompt
    return `${userPrompt}

${medicalContext}

Please consider the medical information above when responding, but remember to:
1. Be conversational and natural
2. Don't diagnose - only provide educational information
3. Suggest consulting a healthcare professional when appropriate`;
  }

  /**
   * Toggle RAG on/off
   */
  toggleRAG(enabled: boolean) {
    this.enabled = enabled;
    console.log(`🔍 Elasticsearch RAG ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Singleton instance
export const elasticsearchRAG = new ElasticsearchRAG();