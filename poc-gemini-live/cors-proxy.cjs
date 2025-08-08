/**
 * CORS Proxy for Elasticsearch
 * Solves CORS issues by proxying requests to Elasticsearch from localhost
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Get configuration from environment variables
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'https://3d6ee28c63cb47b8b8ee7ca0e3a82897.us-central1.gcp.cloud.es.io:443';
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY || 'aTlGR0FaZ0IzenpOYnZndmVwdWE6YThHNmZ4Zi1JOWRNcGtVZDNsM2pNZw==';

// Enable CORS for all routes
app.use(cors());

// Proxy middleware for Elasticsearch
const elasticsearchProxy = createProxyMiddleware({
  target: ELASTICSEARCH_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/elasticsearch': '', // Remove /elasticsearch prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add the authorization header from environment
    proxyReq.setHeader('Authorization', `ApiKey ${ELASTICSEARCH_API_KEY}`);
    console.log(`🔄 Proxying: ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy Error:', err.message);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

// Use the proxy for all /elasticsearch requests
app.use('/elasticsearch', elasticsearchProxy);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CORS Proxy running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 CORS Proxy running on http://localhost:${PORT}`);
  console.log(`📡 Proxying to: ${ELASTICSEARCH_URL}`);
  console.log(`🔧 Usage: Replace Elasticsearch URL with http://localhost:${PORT}/elasticsearch`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});