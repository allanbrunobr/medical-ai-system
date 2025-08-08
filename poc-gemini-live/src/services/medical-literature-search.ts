/**
 * Medical Literature Search Service
 * Integrates with PubMed, medRxiv, and bioRxiv APIs for scientific literature retrieval
 */

export interface MedicalReference {
  pmid?: string;           // PubMed ID
  doi?: string;            // DOI
  title: string;           // Título do paper
  authors: string[];       // Autores
  journal: string;         // Revista
  year: number;            // Ano
  abstract: string;        // Resumo
  relevance_score: number; // Score de relevância (0-1)
  source: 'pubmed' | 'medrxiv' | 'biorxiv' | 'statpearls';
  url: string;             // Link direto
  citation_count?: number; // Número de citações (quando disponível)
  open_access: boolean;    // Se é open access
}

interface SearchResult {
  references: MedicalReference[];
  total_found: number;
  search_terms: string[];
  search_time_ms: number;
  sources_searched: string[];
}

interface SearchOptions {
  max_results?: number;
  years_back?: number;      // Buscar apenas papers dos últimos N anos
  include_preprints?: boolean;
  sort_by?: 'relevance' | 'date' | 'citations';
  use_mesh_terms?: boolean; // Usar MeSH terms quando disponíveis
  mesh_terms?: string[];    // MeSH terms específicos
}

export class MedicalLiteratureSearch {
  private isEnabled = false;
  private cache = new Map<string, { result: SearchResult; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
  private readonly PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly MEDRXIV_BASE_URL = 'https://api.medrxiv.org/details';
  private readonly BIORXIV_BASE_URL = 'https://api.biorxiv.org/details';
  
  // Rate limiting for PubMed API (10 req/s with API key)
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private readonly REQUEST_DELAY = 100; // 100ms between requests = 10 req/s
  
  // PubMed API credentials
  private readonly PUBMED_API_KEY = process.env.PUBMED_API_KEY || '';
  private readonly PUBMED_TOOL = process.env.PUBMED_TOOL_NAME || 'gemini-live-doctor';
  private readonly PUBMED_EMAIL = process.env.PUBMED_EMAIL || 'bruno@developer.com';

  constructor() {
    console.log('📚 Medical Literature Search Service initialized');
    if (!this.PUBMED_API_KEY) {
      console.warn('⚠️ PubMed API key not found - rate limiting will be strict (3 req/s)');
    } else {
      console.log('✅ PubMed API key configured - enhanced rate limit (10 req/s)');
    }
  }

  /**
   * Search medical literature across multiple sources
   */
  async searchMedicalLiterature(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    
    if (!this.isEnabled) {
      return {
        references: [],
        total_found: 0,
        search_terms: [],
        search_time_ms: 0,
        sources_searched: []
      };
    }

    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, options);
    
    // Check cache first
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      console.log('💾 Using cached literature search result');
      return cached;
    }

    try {
      console.log(`📖 Searching medical literature for: "${query}"`);
      console.log(`🔧 Options:`, options);
      
      const searchTerms = this.extractMedicalTerms(query);
      console.log(`🏷️ Extracted search terms:`, searchTerms);
      
      const promises: Promise<MedicalReference[]>[] = [];
      const sourcesSearched: string[] = [];

      // Search PubMed
      console.log('🚀 Starting PubMed search...');
      promises.push(this.searchPubMed(searchTerms, options));
      sourcesSearched.push('PubMed');

      // Search preprints if enabled
      if (options.include_preprints !== false) {
        console.log('🚀 Starting preprint searches (medRxiv + bioRxiv)...');
        promises.push(this.searchMedRxiv(searchTerms, options));
        promises.push(this.searchBioRxiv(searchTerms, options));
        sourcesSearched.push('medRxiv', 'bioRxiv');
      } else {
        console.log('⏭️ Skipping preprint searches (disabled)');
      }

      // Execute searches in parallel
      console.log(`⚡ Executing ${promises.length} parallel searches...`);
      const results = await Promise.allSettled(promises);
      
      // Combine and process results
      const allReferences: MedicalReference[] = [];
      results.forEach((result, index) => {
        const source = sourcesSearched[index];
        if (result.status === 'fulfilled') {
          const refs = result.value;
          allReferences.push(...refs);
          console.log(`✅ ${source}: Found ${refs.length} references`);
        } else {
          console.warn(`❌ ${source}: Search failed -`, result.reason);
        }
      });

      console.log(`📊 Total references before filtering: ${allReferences.length}`);

      // Sort and filter results
      const sortedReferences = this.sortReferences(allReferences, options.sort_by || 'relevance');
      const maxResults = options.max_results || 10;
      const finalReferences = sortedReferences.slice(0, maxResults);

      console.log(`🎯 Final selection: ${finalReferences.length}/${allReferences.length} references`);

      const searchResult: SearchResult = {
        references: finalReferences,
        total_found: allReferences.length,
        search_terms: searchTerms,
        search_time_ms: Date.now() - startTime,
        sources_searched: sourcesSearched
      };

      // Cache the result
      this.setCachedResult(cacheKey, searchResult);
      
      console.log(`✅ Medical literature search completed:`);
      console.log(`   📈 ${finalReferences.length} references selected`);
      console.log(`   ⏱️ ${searchResult.search_time_ms}ms total time`);
      console.log(`   🗄️ Sources: ${sourcesSearched.join(', ')}`);
      
      return searchResult;

    } catch (error) {
      console.error('❌ Medical literature search error:', error);
      return {
        references: [],
        total_found: 0,
        search_terms: [],
        search_time_ms: Date.now() - startTime,
        sources_searched: []
      };
    }
  }

  /**
   * Rate-limited fetch with PubMed API credentials
   */
  private async rateLimitedFetch(url: string): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          console.log(`🔗 PubMed API Call: ${url}`);
          const response = await fetch(url);
          console.log(`📊 Response: ${response.status} ${response.statusText}`);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          resolve(response);
        } catch (error) {
          console.error('❌ PubMed API Error:', error);
          reject(error);
        }
      });
      
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        // Wait between requests to respect rate limit
        if (this.requestQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
        }
      }
    }
    
    this.isProcessingQueue = false;
  }
  
  /**
   * Build PubMed URL with API credentials
   */
  private buildPubMedUrl(endpoint: string, params: Record<string, string>): string {
    const urlParams = new URLSearchParams({
      ...params,
      api_key: this.PUBMED_API_KEY,
      tool: this.PUBMED_TOOL,
      email: this.PUBMED_EMAIL
    });
    
    const url = `${this.PUBMED_BASE_URL}/${endpoint}?${urlParams.toString()}`;
    return url;
  }
  
  /**
   * Search PubMed using E-utilities API with proper credentials and rate limiting
   */
  private async searchPubMed(
    searchTerms: string[],
    options: SearchOptions
  ): Promise<MedicalReference[]> {
    
    try {
      const query = this.buildPubMedQuery(searchTerms, options);
      console.log(`🔍 PubMed search query: "${query}"`);
      
      // Step 1: Search for PMIDs using JSON format for better parsing
      const searchUrl = this.buildPubMedUrl('esearch.fcgi', {
        db: 'pubmed',
        term: query,
        retmax: String(options.max_results || 10),
        retmode: 'json'
      });
      
      const searchResponse = await this.rateLimitedFetch(searchUrl);
      const searchData = await searchResponse.json();
      
      console.log('📊 PubMed search result:', searchData);
      
      const pmids = searchData.esearchresult?.idlist || [];
      
      if (pmids.length === 0) {
        console.log('📭 No PMIDs found for query');
        return [];
      }
      
      console.log(`📚 Found ${pmids.length} PMIDs: ${pmids.join(', ')}`);

      // Step 2: Fetch article details using XML format for complete data
      const fetchUrl = this.buildPubMedUrl('efetch.fcgi', {
        db: 'pubmed',
        id: pmids.join(','),
        retmode: 'xml'
      });
      
      const fetchResponse = await this.rateLimitedFetch(fetchUrl);
      const xmlData = await fetchResponse.text();
      
      console.log(`📄 Received XML data (${xmlData.length} chars)`);
      
      const references = this.parsePubMedXML(xmlData);
      console.log(`✅ Parsed ${references.length} references from PubMed`);
      
      return references;

    } catch (error) {
      console.error('❌ PubMed search error:', error);
      
      // Check for specific API errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        console.error('🚨 Rate limit exceeded! Consider reducing request frequency.');
      } else if (errorMessage.includes('403') || errorMessage.includes('unauthorized')) {
        console.error('🔑 API key issue - check PUBMED_API_KEY configuration');
      }
      
      return [];
    }
  }

  /**
   * Search medRxiv preprints
   */
  private async searchMedRxiv(
    searchTerms: string[],
    options: SearchOptions
  ): Promise<MedicalReference[]> {
    
    try {
      // medRxiv API format: /details/{server}/{date_range}
      const dateRange = this.getDateRange(options.years_back || 2);
      const url = `${this.MEDRXIV_BASE_URL}/medrxiv/${dateRange}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`medRxiv search failed: ${response.status}`);
      }
      
      const data = await response.json();
      const papers = data.collection || [];
      
      // Filter papers by search terms
      const filteredPapers = papers.filter((paper: any) => 
        this.matchesSearchTerms(paper.title + ' ' + (paper.abstract || ''), searchTerms)
      );
      
      return filteredPapers.slice(0, options.max_results || 5).map((paper: any) => 
        this.formatMedRxivReference(paper)
      );

    } catch (error) {
      console.error('❌ medRxiv search error:', error);
      return [];
    }
  }

  /**
   * Search bioRxiv preprints
   */
  private async searchBioRxiv(
    searchTerms: string[],
    options: SearchOptions
  ): Promise<MedicalReference[]> {
    
    try {
      const dateRange = this.getDateRange(options.years_back || 2);
      const url = `${this.BIORXIV_BASE_URL}/biorxiv/${dateRange}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`bioRxiv search failed: ${response.status}`);
      }
      
      const data = await response.json();
      const papers = data.collection || [];
      
      // Filter papers by search terms and medical relevance
      const filteredPapers = papers.filter((paper: any) => 
        this.matchesSearchTerms(paper.title + ' ' + (paper.abstract || ''), searchTerms) &&
        this.isMedicallyRelevant(paper.category)
      );
      
      return filteredPapers.slice(0, options.max_results || 5).map((paper: any) => 
        this.formatBioRxivReference(paper)
      );

    } catch (error) {
      console.error('❌ bioRxiv search error:', error);
      return [];
    }
  }

  /**
   * Extract medical terms from query
   */
  private extractMedicalTerms(query: string): string[] {
    // Remove common words and extract medical terms
    const stopWords = ['o', 'a', 'de', 'do', 'da', 'em', 'com', 'para', 'por', 'que', 'é', 'são'];
    const words = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
    
    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Build PubMed query string with MeSH term support
   */
  private buildPubMedQuery(searchTerms: string[], options: SearchOptions): string {
    let query = '';
    
    // Use MeSH terms if available and enabled
    if (options.use_mesh_terms && options.mesh_terms && options.mesh_terms.length > 0) {
      console.log(`🏷️ Using MeSH terms: ${options.mesh_terms.join(', ')}`);
      
      const meshQueries = options.mesh_terms
        .filter(term => term.trim())
        .map(term => `"${term}"[MeSH Terms]`)
        .slice(0, 3); // Máximo 3 MeSH terms para evitar queries muito específicas
      
      if (meshQueries.length > 0) {
        query = meshQueries.join(' AND ');
        
        // Adicionar termos de busca como OR para ampliar resultados
        if (searchTerms.length > 0) {
          const textTerms = searchTerms.slice(0, 2).join(' OR ');
          query += ` OR (${textTerms})`;
        }
      } else {
        // Fallback para busca textual
        query = searchTerms.join(' OR ');
      }
    } else {
      // Busca textual tradicional
      query = searchTerms.join(' OR ');
    }
    
    // Add date filter
    if (options.years_back) {
      const startYear = new Date().getFullYear() - options.years_back;
      query += ` AND ${startYear}:3000[PDAT]`;
    }
    
    // Add medical filters - mais específicos para MeSH
    if (options.use_mesh_terms && options.mesh_terms && options.mesh_terms.length > 0) {
      query += ' AND (clinical trial[pt] OR systematic review[pt] OR meta-analysis[pt] OR review[pt] OR case reports[pt])';
    } else {
      query += ' AND (clinical[sb] OR systematic[sb] OR meta-analysis[pt] OR review[pt] OR case reports[pt])';
    }
    
    console.log(`🔍 Final PubMed query: "${query}"`);
    return query;
  }

  /**
   * Busca otimizada com MeSH terms
   */
  async searchWithMeshTerms(
    meshTerms: string[],
    searchTerms: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    
    const enhancedOptions: SearchOptions = {
      ...options,
      use_mesh_terms: true,
      mesh_terms: meshTerms
    };

    console.log(`📚 Searching with MeSH terms: [${meshTerms.join(', ')}]`);
    console.log(`🔍 Fallback search terms: [${searchTerms.join(', ')}]`);

    return this.searchMedicalLiterature(searchTerms.join(' '), enhancedOptions);
  }

  /**
   * Parse PubMed XML response
   */
  private parsePubMedXML(xmlData: string): MedicalReference[] {
    // Simplified XML parsing - in production, use a proper XML parser
    const references: MedicalReference[] = [];
    
    try {
      // Extract basic information using regex (simplified approach)
      const articles = xmlData.split('<PubmedArticle>').slice(1);
      
      articles.forEach(article => {
        const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
        const titleMatch = article.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/);
        const abstractMatch = article.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/);
        const yearMatch = article.match(/<PubDate>.*?<Year>(\d{4})<\/Year>/);
        const journalMatch = article.match(/<Title>([^<]+)<\/Title>/);
        
        if (pmidMatch && titleMatch) {
          references.push({
            pmid: pmidMatch[1],
            title: titleMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
            authors: this.extractAuthorsFromXML(article),
            journal: journalMatch ? journalMatch[1] : 'Unknown Journal',
            year: yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear(),
            abstract: abstractMatch ? abstractMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '',
            relevance_score: 0.8, // Default score for PubMed
            source: 'pubmed',
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`,
            open_access: article.includes('free full text') || article.includes('PMC'),
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Error parsing PubMed XML:', error);
    }
    
    return references;
  }

  /**
   * Extract authors from PubMed XML
   */
  private extractAuthorsFromXML(article: string): string[] {
    const authors: string[] = [];
    const authorMatches = article.match(/<Author[^>]*>.*?<\/Author>/g) || [];
    
    authorMatches.forEach(authorXml => {
      const lastNameMatch = authorXml.match(/<LastName>([^<]+)<\/LastName>/);
      const firstNameMatch = authorXml.match(/<ForeName>([^<]+)<\/ForeName>/);
      
      if (lastNameMatch) {
        const lastName = lastNameMatch[1];
        const firstName = firstNameMatch ? firstNameMatch[1] : '';
        authors.push(`${firstName} ${lastName}`.trim());
      }
    });
    
    return authors.slice(0, 5); // Limit to first 5 authors
  }

  /**
   * Format medRxiv reference
   */
  private formatMedRxivReference(paper: any): MedicalReference {
    return {
      doi: paper.doi,
      title: paper.title,
      authors: this.parseAuthors(paper.authors),
      journal: 'medRxiv (preprint)',
      year: new Date(paper.date).getFullYear(),
      abstract: paper.abstract || '',
      relevance_score: 0.6, // Lower score for preprints
      source: 'medrxiv',
      url: `https://www.medrxiv.org/content/10.1101/${paper.doi}`,
      open_access: true
    };
  }

  /**
   * Format bioRxiv reference
   */
  private formatBioRxivReference(paper: any): MedicalReference {
    return {
      doi: paper.doi,
      title: paper.title,
      authors: this.parseAuthors(paper.authors),
      journal: 'bioRxiv (preprint)',
      year: new Date(paper.date).getFullYear(),
      abstract: paper.abstract || '',
      relevance_score: 0.6,
      source: 'biorxiv',
      url: `https://www.biorxiv.org/content/10.1101/${paper.doi}`,
      open_access: true
    };
  }

  /**
   * Parse authors string
   */
  private parseAuthors(authorsString: string): string[] {
    if (!authorsString) return [];
    return authorsString.split(';').map(author => author.trim()).slice(0, 5);
  }

  /**
   * Check if matches search terms
   */
  private matchesSearchTerms(text: string, searchTerms: string[]): boolean {
    const lowerText = text.toLowerCase();
    return searchTerms.some(term => lowerText.includes(term.toLowerCase()));
  }

  /**
   * Check if bioRxiv paper is medically relevant
   */
  private isMedicallyRelevant(category: string): boolean {
    if (!category) return false;
    const medicalCategories = [
      'medicine', 'clinical medicine', 'epidemiology', 'pathology',
      'pharmacology', 'immunology', 'neuroscience', 'biochemistry'
    ];
    return medicalCategories.some(cat => category.toLowerCase().includes(cat));
  }

  /**
   * Sort references by criteria
   */
  private sortReferences(references: MedicalReference[], sortBy: string): MedicalReference[] {
    return references.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.year - a.year;
        case 'citations':
          return (b.citation_count || 0) - (a.citation_count || 0);
        case 'relevance':
        default:
          return b.relevance_score - a.relevance_score;
      }
    });
  }

  /**
   * Get date range for API queries
   */
  private getDateRange(yearsBack: number): string {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - yearsBack);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return `${formatDate(startDate)}/${formatDate(endDate)}`;
  }

  /**
   * Cache management
   */
  private generateCacheKey(query: string, options: SearchOptions): string {
    return `${query}_${JSON.stringify(options)}`;
  }

  private getCachedResult(key: string): SearchResult | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedResult(key: string, result: SearchResult): void {
    this.cache.set(key, { result, timestamp: Date.now() });
    
    // Clean old cache entries periodically
    if (this.cache.size > 100) {
      const cutoff = Date.now() - this.CACHE_TTL;
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < cutoff) {
          this.cache.delete(k);
        }
      }
    }
  }

  /**
   * Enable/disable literature search
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`📚 Medical literature search ${enabled ? 'enabled' : 'disabled'}`);
    
    if (enabled && !this.PUBMED_API_KEY) {
      console.warn('⚠️ PubMed API key missing - search may be rate limited');
    } else if (enabled) {
      console.log('🔑 PubMed API configured with enhanced rate limits');
    }
  }

  /**
   * Check if literature search is available
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }
}

export const medicalLiteratureSearch = new MedicalLiteratureSearch();