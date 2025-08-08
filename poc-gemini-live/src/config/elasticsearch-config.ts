/**
 * Elasticsearch Configuration
 * Manages URLs and API keys for different environments
 */

interface ElasticsearchConfig {
  url: string;
  apiKey: string;
  useProxy: boolean;
}

// Check if running in browser vs Node.js
const isBrowser = typeof window !== 'undefined';

// CORS Proxy configuration for browser environment
const PROXY_URL = 'http://localhost:3001/elasticsearch';
const DIRECT_URL = process.env.ELASTICSEARCH_URL || 'https://3d6ee28c63cb47b8b8ee7ca0e3a82897.us-central1.gcp.cloud.es.io:443';
const API_KEY = process.env.ELASTICSEARCH_API_KEY || 'aTlGR0FaZ0IzenpOYnZndmVwdWE6YThHNmZ4Zi1JOWRNcGtVZDNsM2pNZw==';

export const getElasticsearchConfig = (): ElasticsearchConfig => {
  if (isBrowser) {
    // In browser, use proxy to avoid CORS
    console.log('🌐 Browser environment detected - using CORS proxy');
    return {
      url: PROXY_URL,
      apiKey: API_KEY,
      useProxy: true
    };
  } else {
    // In Node.js, use direct URL
    console.log('🖥️ Node.js environment detected - using direct URL');
    return {
      url: DIRECT_URL,
      apiKey: API_KEY,
      useProxy: false
    };
  }
};

// Individual index URLs
export const getIndexUrl = (indexName: string): string => {
  const config = getElasticsearchConfig();
  return `${config.url}/${indexName}`;
};

// Common indices
export const INDICES = {
  MEDICAL_EMBEDDINGS: 'medical-embeddings',
  SEARCH_MEDICAL_2: 'search-medical-2'
};

// Headers for requests
export const getElasticsearchHeaders = (): HeadersInit => {
  const config = getElasticsearchConfig();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  // Only add Authorization header if not using proxy
  // (proxy adds it automatically)
  if (!config.useProxy) {
    headers['Authorization'] = `ApiKey ${config.apiKey}`;
  }
  
  return headers;
};

export { ElasticsearchConfig };