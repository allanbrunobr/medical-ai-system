// Tipos para o sistema RAG médico

export interface MedicalQuery {
  id: string;
  text: string;
  audioData?: ArrayBuffer;
  timestamp: Date;
  patientId?: string;
  sessionId: string;
}

export interface MedicalDocument {
  id: string;
  content: string;
  metadata: {
    source: string;
    speciality?: string;
    condition?: string;
    lastUpdated: Date;
    reliability: 'high' | 'medium' | 'low';
    urgency_level?: 'critical' | 'high' | 'medium' | 'low';
    tags?: string[];
  };
  embedding?: number[];
}

export interface MedicalResponse {
  id: string;
  queryId: string;
  answer: string;
  sources: MedicalDocument[];
  confidence: number;
  audioResponse?: ArrayBuffer;
  warnings?: string[];
  disclaimer: string;
}

export interface RAGConfig {
  vectorDB: {
    provider: 'pinecone' | 'weaviate' | 'chroma' | 'local';
    endpoint?: string;
    apiKey?: string;
    namespace: string;
  };
  search: {
    topK: number;
    minScore: number;
    reranking: boolean;
  };
  generation: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  };
  voice: {
    inputLanguage: string;
    outputVoice: string;
    speakingRate: number;
  };
}

export interface VoiceSession {
  id: string;
  websocket?: WebSocket;
  isActive: boolean;
  startTime: Date;
  lastActivity: Date;
  transcripts: Array<{
    text: string;
    timestamp: Date;
    speaker: 'user' | 'assistant';
  }>;
}