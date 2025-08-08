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
      const publicKey = import.meta.env.VITE_LANGFUSE_PUBLIC_KEY;
      const secretKey = import.meta.env.VITE_LANGFUSE_SECRET_KEY;
      const baseUrl = import.meta.env.VITE_LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

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

  // Rastrear processamento de áudio em tempo real
  async traceAudioProcessing(audioData: any, processingTime: number, audioQuality: string) {
    console.log('📝 LangTraceService: Tentando rastrear Audio Processing...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Audio Processing');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Audio Processing...');
      const trace = await this.langfuse.trace({
        name: 'Real-time Audio Processing',
        sessionId: this.sessionId,
        tags: [TraceTypes.AUDIO_PROCESSING, 'real-time-audio'],
        metadata: {
          audio_size_bytes: audioData?.length || 0,
          processing_time_ms: processingTime,
          audio_quality,
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: {
          audio_data_size: audioData?.length || 0,
          timestamp: new Date().toISOString(),
        },
        output: {
          processing_time_ms: processingTime,
          audio_quality,
          success: true,
        },
      });

      console.log('✅ LangTraceService: Trace Audio Processing criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Audio Processing:', error);
      return null;
    }
  }

  // Rastrear transcrição de fala
  async traceSpeechToText(transcript: string, audioDuration: number, confidence: number) {
    console.log('📝 LangTraceService: Tentando rastrear Speech to Text...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Speech to Text');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Speech to Text...');
      const trace = await this.langfuse.trace({
        name: 'Speech to Text Transcription',
        sessionId: this.sessionId,
        tags: [TraceTypes.SPEECH_TO_TEXT, 'real-time-stt'],
        metadata: {
          transcript_length: transcript.length,
          audio_duration_ms: audioDuration,
          confidence_score: confidence,
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: {
          audio_duration_ms: audioDuration,
          timestamp: new Date().toISOString(),
        },
        output: {
          transcript,
          confidence_score: confidence,
          transcript_length: transcript.length,
        },
      });

      console.log('✅ LangTraceService: Trace Speech to Text criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Speech to Text:', error);
      return null;
    }
  }

  // Rastrear análise médica em tempo real
  async traceRealTimeMedicalAnalysis(transcript: string, analysisResult: any, responseTime: number) {
    console.log('📝 LangTraceService: Tentando rastrear Real-time Medical Analysis...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Real-time Medical Analysis');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Real-time Medical Analysis...');
      const trace = await this.langfuse.trace({
        name: 'Real-time Medical Analysis',
        sessionId: this.sessionId,
        tags: [TraceTypes.MEDICAL_ANALYSIS, 'real-time-medical'],
        metadata: {
          transcript_length: transcript.length,
          response_time_ms: responseTime,
          entities_found: analysisResult.entities?.conditions?.length || 0,
          symptoms_found: analysisResult.entities?.symptoms?.length || 0,
          emergency_detected: analysisResult.emergency || false,
          timestamp: new Date().toISOString(),
        },
      });

      await trace.update({
        input: {
          transcript,
          timestamp: new Date().toISOString(),
        },
        output: {
          analysis_result: {
            entities: analysisResult.entities,
            emergency: analysisResult.emergency,
            confidence: analysisResult.confidence,
          },
          performance: {
            response_time_ms: responseTime,
            entities_found: analysisResult.entities?.conditions?.length || 0,
            symptoms_found: analysisResult.entities?.symptoms?.length || 0,
          },
        },
      });

      console.log('✅ LangTraceService: Trace Real-time Medical Analysis criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Real-time Medical Analysis:', error);
      return null;
    }
  }

  // Rastrear resposta do Gemini em tempo real
  async traceRealTimeGeminiResponse(prompt: string, response: string, model: string, responseTime: number) {
    console.log('📝 LangTraceService: Tentando rastrear Real-time Gemini Response...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Real-time Gemini Response');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Real-time Gemini Response...');
      const trace = await this.langfuse.trace({
        name: 'Real-time Gemini Medical Response',
        sessionId: this.sessionId,
        tags: [TraceTypes.GEMINI_RESPONSE, 'real-time-gemini'],
        metadata: {
          model,
          prompt_length: prompt.length,
          response_length: response.length,
          response_time_ms: responseTime,
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
        },
      });

      console.log('✅ LangTraceService: Trace Real-time Gemini Response criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Real-time Gemini Response:', error);
      return null;
    }
  }

  // Rastrear sessão de conversa em tempo real
  async traceRealTimeConversationSession(summary: any) {
    console.log('📝 LangTraceService: Tentando rastrear Real-time Conversation Session...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Real-time Conversation Session');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando trace Real-time Conversation Session...');
      const sessionDuration = Date.now() - this.startTime;
      const trace = await this.langfuse.trace({
        name: 'Real-time Medical Conversation Session',
        sessionId: this.sessionId,
        tags: [TraceTypes.CONVERSATION_SESSION, 'real-time-session'],
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

      console.log('✅ LangTraceService: Trace Real-time Conversation Session criado');
      return trace;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no trace Real-time Conversation Session:', error);
      return null;
    }
  }

  // Rastrear qualidade do áudio
  async traceAudioQuality(audioQuality: string, latency: number, errors: string[]) {
    console.log('📝 LangTraceService: Tentando rastrear Audio Quality...');
    
    if (!(await this.isLangfuseAvailable())) {
      console.log('🔄 LangTraceService: Langfuse não disponível, pulando trace Audio Quality');
      return null;
    }

    try {
      console.log('📝 LangTraceService: Criando Audio Quality Score...');
      const qualityScore = {
        audio_quality: audioQuality,
        latency_ms: latency,
        error_count: errors.length,
        errors: errors,
      };

      await this.langfuse.score({
        name: 'audio_quality_score',
        value: audioQuality === 'excellent' ? 1.0 : audioQuality === 'good' ? 0.8 : audioQuality === 'fair' ? 0.6 : 0.4,
        comment: `Quality: ${audioQuality}, Latency: ${latency}ms, Errors: ${errors.length}`,
      });

      console.log('✅ LangTraceService: Audio Quality Score criado');
      return qualityScore;
    } catch (error) {
      console.error('❌ LangTraceService: Erro no Audio Quality:', error);
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
        tags: ['error', 'real-time-system'],
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