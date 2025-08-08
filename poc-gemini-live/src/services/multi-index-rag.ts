/**
 * Multi-Index RAG Integration for Gemini Live Doctor
 * Suporta busca em múltiplos índices simultaneamente
 * Otimizado com BM25 e queries booleanas
 */

interface ElasticsearchHit {
  _source: {
    Disease?: string;
    disease?: string;
    [key: string]: any;
  };
  _score: number;
}

interface MultiIndexResult {
  index: string;
  results: ElasticsearchHit[];
  total: number;
  avg_score: number;
}

interface MultiIndexSearchResponse {
  results: { [index: string]: MultiIndexResult };
  summary: {
    total_results: number;
    successful_indices: number;
    failed_indices: number;
  };
}

export class MultiIndexRAG {
  private elasticsearchUrl: string;
  private apiKey: string;
  private enabled: boolean = true;
  private indices: string[] = ['search-medical', 'search-medical-2'];

  constructor() {
    // Use environment variables or fallback to direct Elasticsearch URL
    this.elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'https://3d6ee28c63cb47b8b8ee7ca0e3a82897.us-central1.gcp.cloud.es.io:443';
    this.apiKey = process.env.ELASTICSEARCH_API_KEY || 'aTlGR0FaZ0IzenpOYnZndmVwdWE6YThHNmZ4Zi1JOWRNcGtVZDNsM2pNZw==';
    
    console.log('🔍 Multi-Index RAG initialized with URL from environment');
    console.log(`📋 Índices configurados: ${this.indices.join(', ')}`);
  }

  /**
   * Busca em múltiplos índices simultaneamente
   * Usa BM25 para texto livre e queries booleanas para sintomas específicos
   */
  async searchMedicalContextMultiIndex(userInput: string): Promise<string> {
    if (!this.enabled || !userInput.trim()) {
      return '';
    }

    try {
      console.log(`🔍 Searching multiple indices for: "${userInput}"`);
      
      // Detectar se é texto livre ou sintomas específicos
      const isFreeText = this._isFreeTextQuery(userInput);
      
      let searchBody;
      if (isFreeText) {
        searchBody = this.createFreeTextSearchQuery(userInput);
      } else {
        searchBody = this.createSymptomSearchQuery(userInput);
      }
      
      const response = await fetch(`${this.elasticsearchUrl}/_msearch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${this.apiKey}`
        },
        body: JSON.stringify({
          indices: this.indices,
          searchBody
        })
      });

      if (!response.ok) {
        console.error(`Multi-index search error: ${response.status}`);
        return '';
      }

      const data: MultiIndexSearchResponse = await response.json();
      
      if (data.summary.total_results === 0) {
        return '';
      }

      // Formatar resultados de múltiplos índices
      const context = this.formatMultiIndexContext(data, isFreeText);
      console.log(`✅ Found results across ${data.summary.successful_indices} indices`);
      
      return context;

    } catch (error) {
      console.error('Multi-index search error:', error);
      return '';
    }
  }

  /**
   * Detectar se a query é texto livre ou sintomas específicos
   */
  private _isFreeTextQuery(input: string): boolean {
    const freeTextIndicators = [
      'paciente', 'chegou', 'com', 'apresenta', 'queixa', 'relata',
      'sintomas', 'dor', 'febre', 'tosse', 'náusea', 'vômito'
    ];
    
    const inputLower = input.toLowerCase();
    return freeTextIndicators.some(indicator => inputLower.includes(indicator));
  }

  /**
   * Criar query para sintomas específicos
   * Usa BM25 para o índice antigo e boolean + BM25 para o novo
   */
  private createSymptomSearchQuery(userInput: string) {
    // Extrair sintomas da entrada
    const symptoms = this._extractSymptoms(userInput);
    
    return {
      size: 3, // Top 3 results per index
      query: {
        bool: {
          should: [
            // BM25 para sintomas específicos
            ...symptoms.map(symptom => ({
              multi_match: {
                query: symptom,
                fields: [
                  "Disease^2", "disease^2",           // Campos de doença
                  "Symptom_*^1.5", "symptoms_present^1.5"  // Campos de sintomas
                ],
                fuzziness: 'AUTO',
                type: 'best_fields'
              }
            }))
          ],
          minimum_should_match: 1
        }
      },
      sort: [
        { "_score": { "order": "desc" } }
      ]
    };
  }

  /**
   * Criar query para texto livre (free-text)
   * Usa BM25 para aumentar recall
   */
  private createFreeTextSearchQuery(userInput: string) {
    return {
      size: 3, // Top 3 results per index
      query: {
        multi_match: {
          query: userInput,
          fields: [
            "Disease^3", "disease^3",           // Campos de doença com boost alto
            "Symptom_*^2", "symptoms_present^2"  // Campos de sintomas com boost médio
          ],
          type: "best_fields",
          fuzziness: "AUTO",
          operator: "or"
        }
      },
      sort: [
        { "_score": { "order": "desc" } }
      ]
    };
  }

  /**
   * Extrair sintomas da entrada do usuário
   */
  private _extractSymptoms(input: string): string[] {
    const commonSymptoms = [
      'fever', 'headache', 'cough', 'chest pain', 'abdominal pain',
      'nausea', 'vomiting', 'dizziness', 'shortness of breath',
      'rash', 'sore throat', 'muscle aches', 'fatigue',
      'loss of appetite', 'swollen glands', 'joint pain',
      'back pain', 'neck pain', 'eye pain', 'ear pain',
      'febre', 'dor de cabeça', 'tosse', 'dor no peito', 'dor abdominal',
      'náusea', 'vômito', 'tontura', 'falta de ar',
      'erupção', 'dor de garganta', 'dores musculares', 'fadiga',
      'perda de apetite', 'gânglios inchados', 'dor nas articulações',
      'dor nas costas', 'dor no pescoço', 'dor nos olhos', 'dor no ouvido'
    ];
    
    const inputLower = input.toLowerCase();
    const foundSymptoms = commonSymptoms.filter(symptom => 
      inputLower.includes(symptom.toLowerCase())
    );
    
    return foundSymptoms.length > 0 ? foundSymptoms : [input];
  }

  /**
   * Formatar resultados de múltiplos índices
   */
  private formatMultiIndexContext(data: MultiIndexSearchResponse, isFreeText: boolean): string {
    const contexts = [];
    
    for (const [indexName, indexResult] of Object.entries(data.results)) {
      if (indexResult.results.length === 0) continue;
      
      const indexContexts = indexResult.results.map((hit, index) => {
        const source = hit._source;
        const disease = source.Disease || source.disease || 'Unknown';
        
        // Extrair sintomas baseado no formato do índice
        let symptoms: string[] = [];
        
        if (indexName === 'search-medical') {
          // Formato antigo: Symptom_1, Symptom_2, etc.
          for (let i = 1; i <= 12; i++) {
            const symptom = source[`Symptom_${i}`];
            if (symptom && symptom.trim()) {
              symptoms.push(symptom.trim());
            }
          }
        } else {
          // Formato novo: symptoms_present array
          symptoms = source.symptoms_present || [];
        }

        const searchMethod = isFreeText ? 'BM25 Free-text' : 'BM25 + Boolean';
        
        return `
Medical Reference ${index + 1} (${indexName}):
Condition: ${disease}
Common Symptoms: ${symptoms.slice(0, 5).join(', ')}
Relevance Score: ${(hit._score * 10).toFixed(1)}/100
Search Method: ${searchMethod}`;
      }).join('\n');

      contexts.push(`\n📋 ${indexName.toUpperCase()} (${indexResult.total} results, avg score: ${indexResult.avg_score.toFixed(2)}):\n${indexContexts}`);
    }

    const searchType = isFreeText ? 'FREE-TEXT' : 'SYMPTOM-SPECIFIC';
    
    return `
[MULTI-INDEX MEDICAL KNOWLEDGE BASE - ${searchType}]
Total Results: ${data.summary.total_results}
Successful Indices: ${data.summary.successful_indices}/${this.indices.length}
${contexts.join('\n')}

Note: This information combines results from multiple medical knowledge bases.
Search optimized with BM25 for text relevance and boolean filters for specific symptoms.
Always consult a healthcare professional for medical advice.
`;
  }

  /**
   * Busca específica em um índice
   */
  async searchMedicalContextSingleIndex(userInput: string, indexName: string): Promise<string> {
    if (!this.enabled || !userInput.trim()) {
      return '';
    }

    try {
      console.log(`🔍 Searching ${indexName} for: "${userInput}"`);
      
      const isFreeText = this._isFreeTextQuery(userInput);
      const searchBody = isFreeText 
        ? this.createFreeTextSearchQuery(userInput)
        : this.createSymptomSearchQuery(userInput);
      
      const response = await fetch(`${this.elasticsearchUrl}/${indexName}/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${this.apiKey}`
        },
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        console.error(`Single index search error: ${response.status}`);
        return '';
      }

      const data = await response.json();
      const hits = data.hits.hits as ElasticsearchHit[];

      if (hits.length === 0) {
        return '';
      }

      // Formatar resultados do índice específico
      const context = this.formatSingleIndexContext(hits, indexName, isFreeText);
      console.log(`✅ Found ${hits.length} results in ${indexName}`);
      
      return context;

    } catch (error) {
      console.error(`Single index search error for ${indexName}:`, error);
      return '';
    }
  }

  /**
   * Formatar resultados de um índice específico
   */
  private formatSingleIndexContext(hits: ElasticsearchHit[], indexName: string, isFreeText: boolean): string {
    const contexts = hits.map((hit, index) => {
      const source = hit._source;
      const disease = source.Disease || source.disease || 'Unknown';
      
      let symptoms: string[] = [];
      
      if (indexName === 'search-medical') {
        // Formato antigo
        for (let i = 1; i <= 12; i++) {
          const symptom = source[`Symptom_${i}`];
          if (symptom && symptom.trim()) {
            symptoms.push(symptom.trim());
          }
        }
      } else {
        // Formato novo
        symptoms = source.symptoms_present || [];
      }

      const searchMethod = isFreeText ? 'BM25 Free-text' : 'BM25 + Boolean';

      return `
Medical Reference ${index + 1}:
Condition: ${disease}
Common Symptoms: ${symptoms.slice(0, 5).join(', ')}
Relevance Score: ${(hit._score * 10).toFixed(1)}/100
Search Method: ${searchMethod}`;
    }).join('\n');

    const searchType = isFreeText ? 'FREE-TEXT' : 'SYMPTOM-SPECIFIC';

    return `
[MEDICAL KNOWLEDGE BASE - ${indexName.toUpperCase()} - ${searchType}]
${contexts}

Note: This information is for educational purposes only. Always consult a healthcare professional for medical advice.
`;
  }

  /**
   * Obter estatísticas dos índices
   */
  async getIndexStats(): Promise<any> {
    try {
      const response = await fetch(`${this.elasticsearchUrl}/_stats`, {
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`
        }
      });
      
      if (!response.ok) {
        console.error(`Stats error: ${response.status}`);
        return {};
      }

      return await response.json();
    } catch (error) {
      console.error('Stats error:', error);
      return {};
    }
  }

  /**
   * Listar índices disponíveis
   */
  async getAvailableIndices(): Promise<any> {
    try {
      const response = await fetch(`${this.elasticsearchUrl}/_cat/indices?format=json`, {
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`
        }
      });
      
      if (!response.ok) {
        console.error(`Indices error: ${response.status}`);
        return {};
      }

      return await response.json();
    } catch (error) {
      console.error('Indices error:', error);
      return {};
    }
  }

  /**
   * Testar conectividade
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.elasticsearchUrl}/_cluster/health`, {
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`
        }
      });
      
      if (!response.ok) {
        console.error(`Health check error: ${response.status}`);
        return false;
      }

      const data = await response.json();
      console.log('✅ Multi-index RAG connection healthy:', data);
      return true;
    } catch (error) {
      console.error('❌ Multi-index RAG connection error:', error);
      return false;
    }
  }

  /**
   * Configurar índices para busca
   */
  setIndices(indices: string[]): void {
    this.indices = indices;
    console.log(`🔧 Índices configurados: ${this.indices.join(', ')}`);
  }

  /**
   * Toggle RAG on/off
   */
  toggleRAG(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`🔍 Multi-index RAG ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enhanced prompt with multi-index medical context
   */
  async enhancePromptWithMultiIndexContext(userPrompt: string): Promise<string> {
    const medicalContext = await this.searchMedicalContextMultiIndex(userPrompt);
    
    if (!medicalContext) {
      return userPrompt;
    }

    // Add context to the prompt
    return `${userPrompt}

${medicalContext}

Please consider the medical information from multiple knowledge bases when responding, but remember to:
1. Be conversational and natural
2. Don't diagnose - only provide educational information
3. Suggest consulting a healthcare professional when appropriate
4. Note that results come from multiple medical databases with optimized BM25 search`;
  }
}

// Singleton instance
export const multiIndexRAG = new MultiIndexRAG(); 