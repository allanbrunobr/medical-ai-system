/**
 * Elasticsearch proxy to handle CORS
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

// Elasticsearch configuration
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'https://3d6ee28c63cb47b8b8ee7ca0e3a82897.us-central1.gcp.cloud.es.io:443';
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY || 'aTlGR0FaZ0IzenpOYnZndmVwdWE6YThHNmZ4Zi1JOWRNcGtVZDNsM2pNZw==';

router.post('/search', async (req, res) => {
  try {
    console.log('📚 Proxying Elasticsearch search request');
    
    const response = await axios.post(
      `${ELASTICSEARCH_URL}/search-medical/_search`,
      req.body,
      {
        headers: {
          'Authorization': `ApiKey ${ELASTICSEARCH_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Elasticsearch search successful');
    res.json(response.data);
  } catch (error) {
    console.error('❌ Elasticsearch proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;