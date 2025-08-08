/**
 * Perplexity AI Search Service
 * Integrates with Perplexity API for real-time medical information search
 */

interface PerplexitySearchResult {
  content: string;
  sources?: string[];
  error?: string;
}

interface PerplexitySearchOptions {
  query: string;
  recency?: 'day' | 'week' | 'month' | 'year';
}

export class PerplexitySearchService {
  private baseUrl = 'https://mcp-perplexity.excalibur-ai.io';
  private isEnabled = false;
  private sessionId: string | null = null;
  private eventSource: EventSource | null = null;

  constructor() {
    console.log('🔍 Perplexity Search Service initialized');
  }

  /**
   * Initialize SSE connection
   */
  private async initializeSSEConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.eventSource = new EventSource(`${this.baseUrl}/sse`);
        
        this.eventSource.onopen = () => {
          console.log('🔗 Perplexity SSE connection opened');
        };

        this.eventSource.addEventListener('endpoint', (event) => {
          const endpoint = event.data;
          // Extract session ID from endpoint like "/messages?sessionId=129fa955-88b6-4f32-bcbe-79e2b74b449f"
          const sessionMatch = endpoint.match(/sessionId=([^&]+)/);
          if (sessionMatch) {
            this.sessionId = sessionMatch[1];
            console.log('✅ Perplexity session ID obtained:', this.sessionId);
            resolve(true);
          } else {
            console.error('❌ Failed to extract session ID from endpoint');
            resolve(false);
          }
        });

        this.eventSource.onerror = (error) => {
          console.error('❌ Perplexity SSE error:', error);
          resolve(false);
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.sessionId) {
            console.error('❌ Perplexity SSE connection timeout');
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        console.error('❌ Failed to initialize Perplexity SSE:', error);
        resolve(false);
      }
    });
  }

  /**
   * Search medical information using Perplexity AI
   */
  async searchMedicalInformation(
    query: string, 
    recency: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<PerplexitySearchResult> {
    
    if (!this.isEnabled) {
      return { 
        content: '',
        error: 'Perplexity search is disabled'
      };
    }

    try {
      console.log(`🌐 Searching Perplexity for: "${query}" (recency: ${recency})`);
      
      // Initialize SSE connection if not already done
      if (!this.sessionId) {
        const connected = await this.initializeSSEConnection();
        if (!connected) {
          throw new Error('Failed to establish Perplexity connection');
        }
      }

      // Send search request
      const searchPayload = {
        jsonrpc: "2.0",
        method: "perplexity_search_web",
        params: {
          query: this.enhanceMedicalQuery(query),
          recency: recency
        },
        id: Date.now()
      };

      const response = await fetch(`${this.baseUrl}/messages?sessionId=${this.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchPayload)
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      
      // Try to parse JSON response
      let searchResult = '';
      try {
        const jsonResult = JSON.parse(result);
        searchResult = jsonResult.result || jsonResult.content || result;
      } catch {
        searchResult = result;
      }
      
      console.log('✅ Perplexity search completed');
      
      return {
        content: this.formatMedicalResult(searchResult),
        sources: this.extractSources(searchResult)
      };

    } catch (error) {
      console.error('❌ Perplexity search error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search for drug interactions using current web information
   */
  async searchDrugInteractions(medications: string[]): Promise<PerplexitySearchResult> {
    const query = `interações medicamentosas ${medications.join(' ')} contraindicações efeitos colaterais Brasil 2024`;
    return this.searchMedicalInformation(query, 'month');
  }

  /**
   * Search for current treatment guidelines
   */
  async searchTreatmentGuidelines(condition: string): Promise<PerplexitySearchResult> {
    const query = `diretrizes tratamento ${condition} SBC SBEM AMB Brasil 2024 protocolo atualizado`;
    return this.searchMedicalInformation(query, 'year');
  }

  /**
   * Search for diagnostic criteria and differential diagnosis
   */
  async searchDiagnosticCriteria(symptoms: string[]): Promise<PerplexitySearchResult> {
    const query = `diagnóstico diferencial ${symptoms.join(' ')} critérios diagnósticos medicina brasileira`;
    return this.searchMedicalInformation(query, 'month');
  }

  /**
   * Search for emergency protocols
   */
  async searchEmergencyProtocols(condition: string): Promise<PerplexitySearchResult> {
    const query = `protocolo emergência ${condition} SAMU urgência Brasil atendimento imediato`;
    return this.searchMedicalInformation(query, 'day');
  }

  /**
   * Enhance medical queries for better search results
   */
  private enhanceMedicalQuery(query: string): string {
    // Add medical context and Brazilian focus
    const medicalTerms = [
      'medicina',
      'diagnóstico',
      'tratamento',
      'sintomas',
      'Brasil',
      'diretrizes médicas'
    ];

    // Check if query already contains medical terms
    const hasmedicalContext = medicalTerms.some(term => 
      query.toLowerCase().includes(term.toLowerCase())
    );

    if (!hasmedicalContext) {
      return `${query} medicina diagnóstico tratamento Brasil`;
    }

    return query;
  }

  /**
   * Format medical search results for clinical use
   */
  private formatMedicalResult(rawResult: string): string {
    if (!rawResult) return '';

    // Clean up the result and format for medical context
    let formatted = rawResult
      .replace(/\n\s*\n/g, '\n\n') // Clean extra newlines
      .replace(/^\s+|\s+$/g, ''); // Trim whitespace

    // Add medical disclaimer if not present
    if (!formatted.toLowerCase().includes('orientação médica')) {
      formatted += '\n\n⚠️ Esta informação é complementar e não substitui avaliação médica profissional.';
    }

    return formatted;
  }

  /**
   * Extract source URLs from search results
   */
  private extractSources(result: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = result.match(urlRegex) || [];
    
    // Filter for medical and academic sources
    return urls.filter(url => {
      const domain = url.toLowerCase();
      return domain.includes('pubmed') || 
             domain.includes('scielo') || 
             domain.includes('anvisa') ||
             domain.includes('gov.br') ||
             domain.includes('sbc.org') ||
             domain.includes('medicina') ||
             domain.includes('medical');
    });
  }

  /**
   * Enable/disable Perplexity search
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled && this.eventSource) {
      this.cleanup();
    }
    
    console.log(`🔍 Perplexity search ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if Perplexity search is available
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }

  /**
   * Cleanup SSE connection
   */
  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.sessionId = null;
      console.log('🧹 Perplexity SSE connection cleaned up');
    }
  }
}

export const perplexitySearch = new PerplexitySearchService();