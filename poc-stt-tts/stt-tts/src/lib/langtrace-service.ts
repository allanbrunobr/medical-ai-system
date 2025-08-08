import { TraceTypes, MedicalMetrics, MedicalContext } from './langfuse-config';

export class LangTraceService {
  private sessionId: string;
  private conversationId: string;
  private startTime: number;
  private langfuse: any = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.conversationId = `conv_${Date.now()}`;
    this.startTime = Date.now();
    console.log('🏁 LangTraceService construído com sessionId:', sessionId);
  }

  // Inicializar Langfuse da mesma forma que o LangfuseTest
  private async initializeLangfuse() {
    if (typeof window === 'undefined') {
      console.log('🔄 LangTraceService: Executando no servidor, pulando inicialização');
      return null;
    }

    if (this.langfuse) {
      console.log('🔄 LangTraceService: Langfuse já inicializado');
      return this.langfuse;
    }

    try {
      console.log('🔧 LangTraceService: Inicializando Langfuse...');
      const publicKey = process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY;
      const secretKey = process.env.NEXT_PUBLIC_LANGFUSE_SECRET_KEY;
      const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

      console.log('🔑 LangTraceService: Public Key:', publicKey ? 'Configurada' : 'Não configurada');
      console.log('🔑 LangTraceService: Secret Key:', secretKey ? 'Configurada' : 'Não configurada');

      if (!publicKey || !secretKey) {
        console.log('❌ LangTraceService: Chaves do Langfuse não configuradas');
        return null;
      }

      console.log('📦 LangTraceService: Importando módulo Langfuse...');
      const langfuseModule = await import('langfuse');
      console.log('✅ LangTraceService: Módulo Langfuse carregado');

      this.langfuse = new langfuseModule.Langfuse({
        publicKey,
        secretKey,
        baseUrl,
      });

      console.log('✅ LangTraceService: Langfuse inicializado com sucesso!');
      return this.langfuse;
    } catch (error: any) {
      console.error('❌ LangTraceService: Erro ao inicializar Langfuse:', error.message);
      return null;
    }
  }

  // Verificar se Langfuse está disponível
  private async isLangfuseAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      console.log('🔄 LangTraceService: Não estamos no cliente');
      return false;
    }

    if (!this.langfuse) {
      console.log('🔄 LangTraceService: Langfuse não inicializado, tentando inicializar...');
      this.langfuse = await this.initializeLangfuse();
    }

    const isAvailable = this.langfuse !== null;
    console.log('🔍 LangTraceService: Langfuse disponível:', isAvailable);
    return isAvailable;
  }

  // Rastrear requisição do frontend para o backend
  async traceFrontendRequest(endpoint: string, requestData: any, responseData: any, responseTime: number) {
    console.log('📝 LangTraceService: Tentando rastrear Frontend Request...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Frontend Request');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Frontend Request...');
      const trace = await this.langfuse.trace({
        name: `Frontend Request - ${endpoint}`,
        sessionId: this.sessionId,
        tags: [TraceTypes.CONVERSATION_SESSION, 'frontend-request'],
        metadata: {
          endpoint,
          response_time_ms: responseTime,
          request_size: JSON.stringify(requestData).length,
          response_size: JSON.stringify(responseData).length,
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: {
          endpoint,
          request_data: requestData,
          timestamp: new Date().toISOString(),
        },
        output: {
          response_data: responseData,
          response_time_ms: responseTime,
          success: true,
        },
      });

      console.log('✅ LangTraceService: Trace Frontend Request criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Frontend Request:', error);
      return null;
    }
  }

  // Rastrear performance do pipeline médico
  async tracePipelinePerformance(transcript: string, pipelineResult: any, totalTime: number) {
    console.log('📝 LangTraceService: Tentando rastrear Pipeline Performance...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Pipeline Performance');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Pipeline Performance...');
      const trace = await this.langfuse.trace({
        name: 'Medical Pipeline Performance',
        sessionId: this.sessionId,
        tags: [TraceTypes.MEDICAL_ANALYSIS, 'pipeline-performance'],
        metadata: {
          transcript_length: transcript.length,
          total_time_ms: totalTime,
          entities_found: pipelineResult.entities?.conditions?.length || 0,
          symptoms_found: pipelineResult.entities?.symptoms?.length || 0,
          elasticsearch_results: pipelineResult.elasticsearchResults?.length || 0,
          pubmed_papers: pipelineResult.pubmedPapers?.length || 0,
          synthesis_length: pipelineResult.synthesis?.length || 0,
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: {
          transcript,
          timestamp: new Date().toISOString(),
        },
        output: {
          pipeline_result: {
            entities: pipelineResult.entities,
            elasticsearch_results_count: pipelineResult.elasticsearchResults?.length || 0,
            pubmed_papers_count: pipelineResult.pubmedPapers?.length || 0,
            synthesis_length: pipelineResult.synthesis?.length || 0,
          },
          performance: {
            total_time_ms: totalTime,
            entities_found: pipelineResult.entities?.conditions?.length || 0,
            symptoms_found: pipelineResult.entities?.symptoms?.length || 0,
          },
        },
      });

      console.log('✅ LangTraceService: Trace Pipeline Performance criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Pipeline Performance:', error);
      return null;
    }
  }

  // Rastrear resposta do Gemini
  async traceGeminiResponse(prompt: string, response: string, model: string, responseTime: number, tokens: number) {
    console.log('📝 LangTraceService: Tentando rastrear Gemini Response...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Gemini Response');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Gemini Response...');
      const trace = await this.langfuse.trace({
        name: 'Gemini Medical Response',
        sessionId: this.sessionId,
        tags: [TraceTypes.GEMINI_RESPONSE, 'gemini-medical'],
        metadata: {
          model,
          prompt_length: prompt.length,
          response_length: response.length,
          response_time_ms: responseTime,
          estimated_tokens: tokens,
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: {
          prompt: prompt.substring(0, 1000) + (prompt.length > 1000 ? '...' : ''),
          model,
          timestamp: new Date().toISOString(),
        },
        output: {
          response: response.substring(0, 1000) + (response.length > 1000 ? '...' : ''),
          model,
          response_time_ms: responseTime,
          estimated_tokens: tokens,
        },
      });

      console.log('✅ LangTraceService: Trace Gemini Response criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Gemini Response:', error);
      return null;
    }
  }

  // Rastrear busca no Elasticsearch
  async traceElasticsearchSearch(query: string, results: any[], responseTime: number) {
    console.log('📝 LangTraceService: Tentando rastrear Elasticsearch Search...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Elasticsearch Search');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Elasticsearch Search...');
      const trace = await this.langfuse.trace({
        name: 'Elasticsearch Medical Search',
        sessionId: this.sessionId,
        tags: [TraceTypes.ELASTICSEARCH_SEARCH, 'elasticsearch-medical'],
        metadata: {
          query_length: query.length,
          results_count: results.length,
          response_time_ms: responseTime,
          search_type: 'medical_knowledge',
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: { query },
        output: {
          results_count: results.length,
          top_results: results.slice(0, 3),
          response_time_ms: responseTime,
        },
      });

      console.log('✅ LangTraceService: Trace Elasticsearch Search criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Elasticsearch Search:', error);
      return null;
    }
  }

  // Rastrear busca no PubMed
  async tracePubMedSearch(query: string, papers: any[], responseTime: number) {
    console.log('📝 LangTraceService: Tentando rastrear PubMed Search...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace PubMed Search');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace PubMed Search...');
      const trace = await this.langfuse.trace({
        name: 'PubMed Scientific Search',
        sessionId: this.sessionId,
        tags: ['pubmed-search', 'scientific-literature'],
        metadata: {
          query_length: query.length,
          papers_count: papers.length,
          response_time_ms: responseTime,
          search_type: 'scientific_literature',
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: { query },
        output: {
          papers_count: papers.length,
          papers: papers.slice(0, 3),
          response_time_ms: responseTime,
        },
      });

      console.log('✅ LangTraceService: Trace PubMed Search criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace PubMed Search:', error);
      return null;
    }
  }

  // Rastrear sessão completa
  async traceConversationSession(summary: any) {
    console.log('📝 LangTraceService: Tentando rastrear Conversation Session...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Conversation Session');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Conversation Session...');
      const sessionDuration = Date.now() - this.startTime;
      const trace = await this.langfuse.trace({
        name: 'Medical Conversation Session',
        sessionId: this.sessionId,
        tags: [TraceTypes.CONVERSATION_SESSION, 'medical-session'],
        metadata: {
          session_duration_ms: sessionDuration,
          conversation_id: this.conversationId,
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: { session_id: this.sessionId },
        output: {
          session_summary: summary,
          conversation_id: this.conversationId,
          session_duration_ms: sessionDuration,
        },
      });

      console.log('✅ LangTraceService: Trace Conversation Session criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Conversation Session:', error);
      return null;
    }
  }

  // Métricas de segurança médica
  async trackMedicalSafety(analysis: any) {
    console.log('📝 LangTraceService: Tentando rastrear Medical Safety...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando Medical Safety');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando Medical Safety Score...');
      const safetyMetrics = {
        emergency_detected: analysis.emergency || false,
        high_risk_conditions: analysis.high_risk_conditions || [],
        safety_warnings: analysis.safety_warnings || [],
        confidence_threshold_met: analysis.confidence > 0.7,
      };

      await this.langfuse.score({
        name: 'medical_safety_score',
        value: safetyMetrics.emergency_detected ? 0 : 1,
        comment: `Emergency: ${safetyMetrics.emergency_detected}, Warnings: ${safetyMetrics.safety_warnings.length}`,
      });

      console.log('✅ LangTraceService: Medical Safety Score criado');
      return safetyMetrics;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no Medical Safety:', error);
      return null;
    }
  }

  // Rastrear erro
  async traceError(error: any, context: string) {
    console.log('📝 LangTraceService: Tentando rastrear Error...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Error');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Error...');
      const trace = await this.langfuse.trace({
        name: `Error - ${context}`,
        sessionId: this.sessionId,
        tags: ['error', 'medical-system'],
        metadata: {
          error_type: error.name || 'Unknown',
          error_message: error.message,
          context,
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: { context },
        output: {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
      });

      console.log('✅ LangTraceService: Trace Error criado');
      return trace;
    } catch (traceError) {
      console.error('❌ LangTraceService: Erro ao rastrear erro:', traceError);
      return null;
    }
  }
} 