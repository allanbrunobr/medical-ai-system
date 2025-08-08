// Configuração do Langfuse REAL para STT-TTS
let langfuse: any = null;
let isInitializing = false;

// Função para inicializar o Langfuse
async function initializeLangfuse() {
  // Só inicializa no cliente
  if (typeof window === 'undefined') {
    console.log('🔄 Langfuse: Executando no servidor, pulando inicialização');
    return null;
  }

  // Verifica se já foi inicializado ou está inicializando
  if (langfuse || isInitializing) {
    return langfuse;
  }

  isInitializing = true;

  try {
    // Dynamic import apenas no cliente
    const langfuseModule = await import('langfuse');
    langfuse = new langfuseModule.Langfuse({
      publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY || '',
      secretKey: process.env.NEXT_PUBLIC_LANGFUSE_SECRET_KEY || '', // Usar a mesma chave que funciona no LangfuseTest
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    });
    console.log('✅ Langfuse REAL inicializado com sucesso!');
    return langfuse;
  } catch (error: any) {
    console.error('❌ Erro ao inicializar Langfuse:', error.message);
    return null;
  } finally {
    isInitializing = false;
  }
}

// Função para obter instância do Langfuse
export async function getLangfuse() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!langfuse && !isInitializing) {
    await initializeLangfuse();
  }
  
  return langfuse;
}

// Inicializar apenas no cliente de forma assíncrona
if (typeof window !== 'undefined') {
  // Inicializa de forma assíncrona sem bloquear
  setTimeout(() => {
    initializeLangfuse().catch((error) => {
      console.log('🔄 Langfuse: Inicialização assíncrona falhou:', error.message);
    });
  }, 100);
}

export { langfuse };

// Tipos de traces para STT-TTS
export enum TraceTypes {
  SPEECH_TO_TEXT = 'speech_to_text',
  TEXT_TO_SPEECH = 'text_to_speech',
  MEDICAL_ANALYSIS = 'medical_analysis',
  ELASTICSEARCH_SEARCH = 'elasticsearch_search',
  GEMINI_RESPONSE = 'gemini_response',
  CONVERSATION_SESSION = 'conversation_session',
}

// Métricas médicas específicas
export interface MedicalMetrics {
  diagnosis_confidence: number;
  evidence_citations: number;
  response_time_ms: number;
  symptoms_extracted: number;
  medical_entities_found: number;
  emergency_detected: boolean;
}

// Contexto médico para traces
export interface MedicalContext {
  patient_age?: number;
  patient_gender?: string;
  symptoms: string[];
  medical_history?: string[];
  urgency_level: 'low' | 'medium' | 'high' | 'emergency';
  specialty?: string;
} 