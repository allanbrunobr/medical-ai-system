import { NextRequest, NextResponse } from 'next/server';
import { elasticsearchRAG, initializeElasticsearchRAG } from '@/lib/medical-rag/elasticsearch-rag';
import { MedicalQuery } from '@/lib/medical-rag/types';

// Flag para garantir inicialização única
let ragInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function ensureRAGInitialized() {
  if (!ragInitialized && !initializationPromise) {
    initializationPromise = initializeElasticsearchRAG()
      .then(() => {
        ragInitialized = true;
        console.log('✅ Elasticsearch RAG inicializado com sucesso');
      })
      .catch((error) => {
        console.error('❌ Erro na inicialização do Elasticsearch RAG:', error);
        // Reset para permitir nova tentativa
        initializationPromise = null;
        throw error;
      });
  }
  
  if (initializationPromise) {
    await initializationPromise;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse do body
    const body = await request.json();
    const { text, patientId, sessionId } = body;

    // Validação básica
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Texto da pergunta é obrigatório',
          code: 'MISSING_TEXT'
        },
        { status: 400 }
      );
    }

    // Log da consulta
    console.log(`🩺 [${new Date().toISOString()}] Nova consulta médica:`, {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      patientId: patientId || 'anonymous',
      sessionId: sessionId || 'no-session'
    });

    // Inicializa RAG se necessário
    try {
      await ensureRAGInitialized();
    } catch (initError) {
      console.error('❌ Falha na inicialização do RAG:', initError);
      
      return NextResponse.json({
        success: false,
        response: {
          text: 'Sistema médico temporariamente indisponível. Por favor, consulte um profissional de saúde presencialmente ou tente novamente em alguns minutos.',
          confidence: 0,
          warnings: ['⚠️ Sistema RAG não disponível'],
          sources: []
        },
        error: 'RAG initialization failed',
        code: 'RAG_INIT_ERROR'
      }, { status: 503 });
    }

    // Cria query médica estruturada
    const medicalQuery: MedicalQuery = {
      id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      patientId: patientId || 'anonymous',
      sessionId: sessionId || `session-${Date.now()}`,
      timestamp: new Date()
    };

    // Processa com Elasticsearch RAG
    console.log(`🔍 Processando query ${medicalQuery.id} com Elasticsearch...`);
    const ragResponse = await elasticsearchRAG.processMedicalQuery(medicalQuery);

    const processingTime = Date.now() - startTime;

    // Formata resposta
    const response = {
      success: true,
      response: {
        text: ragResponse.answer,
        confidence: ragResponse.confidence,
        warnings: ragResponse.warnings,
        sources: ragResponse.sources.map(doc => ({
          id: doc.id,
          title: doc.metadata.condition,
          source: doc.metadata.source,
          speciality: doc.metadata.speciality,
          reliability: doc.metadata.reliability,
          excerpt: doc.content.substring(0, 200) + '...'
        }))
      },
      metadata: {
        queryId: ragResponse.queryId,
        responseId: ragResponse.id,
        processingTime,
        ragType: 'elasticsearch',
        version: '1.0.0',
        documentsUsed: ragResponse.sources.length,
        timestamp: new Date().toISOString()
      }
    };

    // Log de sucesso
    console.log(`✅ Consulta ${medicalQuery.id} processada:`, {
      processingTime: `${processingTime}ms`,
      confidence: ragResponse.confidence.toFixed(3),
      documentsUsed: ragResponse.sources.length,
      hasWarnings: (ragResponse.warnings || []).length > 0
    });

    return NextResponse.json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('❌ Erro na API médica:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime}ms`
    });

    // Resposta de erro estruturada
    return NextResponse.json({
      success: false,
      response: {
        text: 'Desculpe, ocorreu um erro interno ao processar sua pergunta. Por favor, consulte um profissional de saúde ou tente novamente em alguns minutos.',
        confidence: 0,
        warnings: [
          '⚠️ Sistema temporariamente indisponível',
          '🏥 Recomenda-se buscar atendimento médico presencial'
        ],
        sources: []
      },
      error: error instanceof Error ? error.message : 'Erro interno',
      code: 'INTERNAL_ERROR',
      metadata: {
        processingTime,
        timestamp: new Date().toISOString(),
        ragType: 'elasticsearch'
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Status do sistema
    const stats = await elasticsearchRAG.getIndexStats();
    
    return NextResponse.json({
      status: 'Medical Elasticsearch RAG API',
      version: '1.0.0',
      healthy: true,
      features: [
        'Busca híbrida (texto + semântica)',
        'Embeddings com Gemini',
        'Análise médica especializada',
        'Detecção de emergências',
        'Auditoria completa',
        'Sinônimos médicos'
      ],
      elasticsearch: {
        connected: !!stats,
        documents: stats?._all?.primaries?.docs?.count || 0,
        indexSize: stats?._all?.primaries?.store?.size_in_bytes || 0
      },
      endpoints: {
        POST: '/api/medical/chat - Consulta médica',
        GET: '/api/medical/chat - Status do sistema'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      status: 'Medical Elasticsearch RAG API',
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}

/**
 * Detecta nível de urgência baseado em palavras-chave médicas
 */
function detectUrgencyLevel(text: string): 'low' | 'medium' | 'high' | 'emergency' {
  const lowerText = text.toLowerCase();

  // Padrões de emergência médica
  const emergencyPatterns = [
    /dor\s+no\s+peito/,
    /falta\s+de\s+ar\s+severa?/,
    /dificuldade\s+para\s+respirar/,
    /desmaio|desmaiei/,
    /convuls[ãa]o/,
    /sangramento\s+intenso/,
    /perda\s+de\s+consci[êe]ncia/,
    /paralisia\s+s[úu]bita/,
    /dor\s+intensa\s+e\s+s[úu]bita/,
    /vis[ãa]o\s+turva\s+s[úu]bita/
  ];

  // Padrões de alta urgência
  const highUrgencyPatterns = [
    /dor\s+intensa/,
    /febre\s+alta|febre\s+acima/,
    /v[ôo]mito\s+persistente/,
    /sangramento/,
    /dor\s+s[úu]bita/,
    /incha[çc]o\s+s[úu]bito/,
    /tontura\s+intensa/,
    /palpita[çc][õo]es\s+fortes/
  ];

  // Padrões de média urgência
  const mediumUrgencyPatterns = [
    /dor\s+h[áa]\s+\d+\s+dias/,
    /febre/,
    /tosse\s+persistente/,
    /dor\s+de\s+cabe[çc]a\s+forte/,
    /n[áa]usea/,
    /tontura|tonto/,
    /dor\s+abdominal/,
    /queima[çc][ãa]o/
  ];

  // Verifica padrões de emergência
  if (emergencyPatterns.some(pattern => pattern.test(lowerText))) {
    return 'emergency';
  }

  // Verifica alta urgência
  if (highUrgencyPatterns.some(pattern => pattern.test(lowerText))) {
    return 'high';
  }

  // Verifica média urgência
  if (mediumUrgencyPatterns.some(pattern => pattern.test(lowerText))) {
    return 'medium';
  }

  // Baixa urgência (sintomas leves, consultas gerais)
  return 'low';
}