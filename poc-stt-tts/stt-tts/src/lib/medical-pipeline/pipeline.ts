import fetch from 'node-fetch';
import { LangTraceService } from '../langtrace-service';

// Configurações (substitua por variáveis de ambiente em produção)
const ELASTICSEARCH_URL = process.env.NEXT_PUBLIC_ELASTICSEARCH_URL || process.env.ELASTICSEARCH_URL!;
const API_KEY = process.env.NEXT_PUBLIC_ELASTICSEARCH_API_KEY || process.env.ELASTICSEARCH_API_KEY!;
const MEDICAL_EMBEDDINGS_INDEX = 'medical-embeddings';
const SEARCH_MEDICAL_DB = 'search-medical-2';
const GOOGLE_AI_KEY = process.env.NEXT_PUBLIC_GOOGLE_AI_KEY || process.env.GOOGLE_AI_KEY!;
const PUBMED_API_KEY = process.env.NEXT_PUBLIC_PUBMED_API_KEY || process.env.PUBMED_API_KEY!;

export interface MedicalPipelineResult {
  entities: any;
  embedding: number[];
  elasticsearchResults: any[];
  pubmedPapers: any[];
  synthesis: string;
}

export async function extrairEntidadesEGerarEmbedding(textoPT: string) {
  // Copiado/adaptado de test-complete-flow.js
  const prompt = `Analise este caso clínico e extraia informações estruturadas:\n\n"${textoPT}"\n\nResponda em JSON:\n{\n    "patient_info": {"age": number, "gender": "M/F"},\n    "conditions": [{"pt": "condição PT", "en": "condition EN", "mesh": "MeSH term"}],\n    "symptoms": [{"pt": "sintoma PT", "en": "symptom EN"}],\n    "severity": "mild/moderate/severe",\n    "english_query": "query em inglês para busca",\n    "confidence": 0.0-1.0\n}`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GOOGLE_AI_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    })
  });
  const data: any = await response.json();
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = texto.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON não encontrado na resposta do LLM');
  const entidades = JSON.parse(jsonMatch[0]);

  // Gerar embedding
  const embeddingResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GOOGLE_AI_KEY
    },
    body: JSON.stringify({
      model: 'models/embedding-001',
      content: { parts: [{ text: entidades.english_query }] }
    })
  });
  const embeddingData: any = await embeddingResponse.json();
  const embedding = embeddingData.embedding?.values;
  if (!embedding) throw new Error('Embedding não gerado');
  return { entidades, embedding };
}

export async function buscaHibridaElasticsearch(entidades: any, embedding: number[]) {
  const resultados: any[] = [];
  // Busca por embedding
  const embeddingBody = {
    size: 5,
    query: {
      script_score: {
        query: { match_all: {} },
        script: {
          source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
          params: { query_vector: embedding }
        }
      }
    },
    min_score: 1.1
  };
  try {
    const embeddingResponse = await fetch(`${ELASTICSEARCH_URL}/${MEDICAL_EMBEDDINGS_INDEX}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${API_KEY}`
      },
      body: JSON.stringify(embeddingBody)
    });
    if (embeddingResponse.ok) {
      const embeddingData: any = await embeddingResponse.json();
      const embeddingHits = embeddingData.hits?.hits || [];
      embeddingHits.forEach((hit: any) => {
        const doenca = hit._source.disease || hit._source.Disease;
        if (doenca) {
          resultados.push({
            disease: doenca,
            score: hit._score,
            source: 'embedding',
            similarity: ((hit._score - 1) * 100).toFixed(1)
          });
        }
      });
    }
  } catch (error) {
    // Ignore erro
  }
  // Busca textual
  const textBody = {
    size: 5,
    query: {
      bool: {
        should: [
          {
            match: {
              disease: {
                query: entidades.english_query,
                boost: 3.0
              }
            }
          }
        ]
      }
    },
    min_score: 1.0
  };
  try {
    const textResponse = await fetch(`${ELASTICSEARCH_URL}/${SEARCH_MEDICAL_DB}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${API_KEY}`
      },
      body: JSON.stringify(textBody)
    });
    if (textResponse.ok) {
      const textData: any = await textResponse.json();
      const textHits = textData.hits?.hits || [];
      textHits.forEach((hit: any) => {
        resultados.push({
          disease: hit._source.disease,
          score: hit._score,
          source: 'text',
          symptoms: hit._source.symptoms
        });
      });
    }
  } catch (error) {
    // Ignore erro
  }
  // Remover duplicatas e ordenar
  const doencasUnicas = new Map();
  resultados.forEach(r => {
    const key = r.disease.toLowerCase();
    if (!doencasUnicas.has(key) || r.score > doencasUnicas.get(key).score) {
      doencasUnicas.set(key, r);
    }
  });
  const topResultados = Array.from(doencasUnicas.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return topResultados;
}

export async function buscarPubMedComplementar(entidades: any, condicoesElasticsearch: any[]) {
  // Usar MeSH terms das condições identificadas, normalizando para o termo principal
  let meshTerms = entidades.conditions
    .filter((c: any) => c.mesh)
    .map((c: any) => {
      // Usa só o termo principal antes da vírgula
      const meshMain = c.mesh.split(',')[0].trim();
      return `"${meshMain}"[MeSH Terms]`;
    });

  // Se não houver MeSH, usar nomes em inglês das condições
  if (meshTerms.length === 0) {
    meshTerms = entidades.conditions
      .map((c: any) => `"${c.en}"`);
  }

  // Se ainda assim não houver, usar english_query
  let query = meshTerms.length > 0
    ? meshTerms.join(' AND ')
    : `"${entidades.english_query}"`;

  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=3&retmode=json&api_key=${PUBMED_API_KEY}&sort=relevance`;
    const response = await fetch(searchUrl);
    const data: any = await response.json();
    const pmids = data.esearchresult?.idlist || [];
    if (pmids.length === 0) return [];
    // Buscar detalhes + abstracts
    const detailsUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json&api_key=${PUBMED_API_KEY}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData: any = await detailsResponse.json();
    const papers = pmids.map((pmid: string) => {
      const paper = detailsData.result[pmid];
      return {
        pmid,
        title: paper?.title || 'Título não disponível',
        authors: paper?.authors?.slice(0, 3).map((a: any) => a.name).join(', ') || 'Autores não disponíveis',
        journal: paper?.source || 'Journal não disponível',
        year: paper?.pubdate?.split(' ')[0] || '2024',
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      };
    });
    return papers;
  } catch (error) {
    return [];
  }
}

export async function sinteseCompleta(entidades: any, condicoesElasticsearch: any[], papersPubmed: any[]) {
  const prompt = `Você é um médico especialista. Baseado nos dados de múltiplas fontes, forneça uma análise completa:\n\nPACIENTE: ${entidades.patient_info.gender}, ${entidades.patient_info.age} anos\nSINTOMAS: ${entidades.symptoms.map((s: any) => s.pt).join(', ')}\nSEVERIDADE: ${entidades.severity}\n\nRESULTADOS ELASTICSEARCH:\n${condicoesElasticsearch.map((c: any, i: number) => `${i+1}. ${c.disease} (${c.source} search, score: ${c.score.toFixed(1)})`).join('\n')}\n\nLITERATURA CIENTÍFICA (PUBMED):\n${papersPubmed.map((p: any, i: number) => `${i+1}. ${p.title} (${p.journal}, ${p.year})`).join('\n')}\n\nFORNEÇA:\n1. **Diagnóstico Principal** (baseado na integração das fontes)\n2. **Diagnósticos Diferenciais** (2-3 alternativas)\n3. **Avaliação da Concordância** entre Elasticsearch e literatura\n4. **Recomendações Clínicas** específicas para este caso\n5. **Citações das Evidências** usando [Autor et al., Ano]\n\nResponda em português, estruturado e baseado em evidências múltiplas.`;
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_AI_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
      })
    });
    const data: any = await response.json();
    const sintese = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return sintese;
  } catch (error) {
    return 'Erro na síntese final.';
  }
}

export async function runMedicalPipeline(transcript: string): Promise<MedicalPipelineResult> {
  const startTime = Date.now();

  try {
    console.log('🔍 Iniciando pipeline médico...');

    // Etapa 1: Extração de entidades e embedding
    const entityStartTime = Date.now();
    const resultado1 = await extrairEntidadesEGerarEmbedding(transcript);
    if (!resultado1 || resultado1.entidades.confidence < 0.7) {
      throw new Error('Baixa confiança na extração');
    }
    const { entidades, embedding } = resultado1;
    const entityTime = Date.now() - entityStartTime;

    console.log('Análise médica:', entidades);
    console.log('Embedding gerado:', embedding);

    // Etapa 2: Busca no Elasticsearch
    const elasticsearchStartTime = Date.now();
    const condicoesElasticsearch = await buscaHibridaElasticsearch(entidades, embedding);
    const elasticsearchTime = Date.now() - elasticsearchStartTime;
    
    console.log('Resultados do Elasticsearch:', condicoesElasticsearch);

    // Etapa 3: Busca no PubMed
    const pubmedStartTime = Date.now();
    const papersPubmed = await buscarPubMedComplementar(entidades, condicoesElasticsearch);
    const pubmedTime = Date.now() - pubmedStartTime;

    console.log('Papers do PubMed:', papersPubmed);

    // Etapa 4: Síntese final
    const synthesisStartTime = Date.now();
    const synthesis = await sinteseCompleta(entidades, condicoesElasticsearch, papersPubmed);
    const synthesisTime = Date.now() - synthesisStartTime;

    console.log('Síntese final:', synthesis);

    // Resultado final
    const result = {
      entities: entidades,
      embedding,
      elasticsearchResults: condicoesElasticsearch,
      pubmedPapers: papersPubmed,
      synthesis,
      performance: {
        total_time_ms: Date.now() - startTime,
        entity_extraction_ms: entityTime,
        elasticsearch_search_ms: elasticsearchTime,
        pubmed_search_ms: pubmedTime,
        synthesis_ms: synthesisTime,
      }
    };

    return result;
  } catch (error) {
    console.error('❌ Erro no pipeline médico:', error);
    throw error;
  }
} 