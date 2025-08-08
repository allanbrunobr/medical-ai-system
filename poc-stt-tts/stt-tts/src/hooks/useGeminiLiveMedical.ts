import { useState, useCallback, useRef, useEffect } from 'react';
import { GeminiLiveClient, GeminiLiveConfig } from '@/lib/gemini-live/client';
import { MedicalResponse } from '@/lib/medical-rag/types';
import { emergencyKeywords } from '@/lib/medical-rag/config';

interface UseGeminiLiveMedicalOptions {
  patientId?: string;
  onResponse?: (response: MedicalResponse) => void;
  onEmergency?: () => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
  wsUrl?: string;
}

export function useGeminiLiveMedical(options: UseGeminiLiveMedicalOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);

  // Detecta emergência médica
  const checkEmergency = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    const hasEmergency = emergencyKeywords.some(keyword => 
      lowerText.includes(keyword)
    );
    
    if (hasEmergency && options.onEmergency) {
      options.onEmergency();
      return true;
    }
    
    return false;
  }, [options.onEmergency]);

  // Conecta ao Gemini Live
  const connect = useCallback(async () => {
    try {
      setError(null);
      setIsProcessing(true);
      
      // Configuração do cliente
      const config: GeminiLiveConfig = {
        wsUrl: options.wsUrl || process.env.NEXT_PUBLIC_GEMINI_LIVE_WS || 'ws://localhost:8080',
                  model: process.env.NEXT_PUBLIC_GEMINI_MODEL_LIVE || 'gemini-2.5-flash',
        language: 'pt-BR',
        voice: 'Puck',
        medicalMode: true,
      };
      
      // Callbacks
      const callbacks = {
        onConnect: () => {
          setIsConnected(true);
          setIsProcessing(false);
          console.log('Conectado ao Gemini Live');
        },
        
        onDisconnect: () => {
          setIsConnected(false);
          setIsListening(false);
          console.log('Desconectado do Gemini Live');
        },
        
        onTranscript: (text: string) => {
          // Não mostra transcrição, apenas verifica emergência
          if (checkEmergency(text)) {
            stopListening();
          }
        },
        
        onResponse: (text: string) => {
          // Não mostra texto da resposta, apenas áudio
          setIsProcessing(false);
        },
        
        onAudio: (audioData: ArrayBuffer) => {
          console.log('🔊 Áudio recebido, iniciando reprodução...');
          setIsSpeaking(true);
        },
        
        onAudioEnded: () => {
          console.log('🔊 Reprodução de áudio finalizada');
          setIsSpeaking(false);
        },
        
        onError: (error: string) => {
          setError(error);
          setIsProcessing(false);
          if (options.onError) {
            options.onError(error);
          }
        },
      };
      
      // Cria e conecta cliente
      clientRef.current = new GeminiLiveClient(config, callbacks);
      await clientRef.current.connect();
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao conectar';
      setError(errorMsg);
      setIsProcessing(false);
      
      if (options.onError) {
        options.onError(errorMsg);
      }
    }
  }, [options, checkEmergency]);

  // Inicia escuta
  const startListening = useCallback(async () => {
    if (!clientRef.current || !isConnected) {
      setError('Não conectado ao Gemini Live');
      return;
    }
    
    try {
      setError(null);
      await clientRef.current.startRecording();
      setIsListening(true);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao iniciar gravação';
      setError(errorMsg);
      setIsListening(false);
    }
  }, [isConnected]);

  // Para escuta
  const stopListening = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stopRecording();
      setIsListening(false);
    }
  }, []);

  // Envia pergunta por texto
  const askQuestion = useCallback((text: string) => {
    if (!clientRef.current || !isConnected) {
      setError('Não conectado ao Gemini Live');
      return;
    }
    
    setTranscript(text);
    setIsProcessing(true);
    
    // Verifica emergência
    if (!checkEmergency(text)) {
      clientRef.current.sendText(text);
    }
  }, [isConnected, checkEmergency]);

  // Desconecta
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    
    setIsConnected(false);
    setIsListening(false);
  }, []);

  // Auto-conecta se configurado
  useEffect(() => {
    if (options.autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, []);

  // Detecta avisos médicos
  function detectWarnings(text: string): string[] {
    const warnings: string[] = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('medicamento') || lowerText.includes('remédio')) {
      warnings.push('💊 Nunca inicie ou interrompa medicamentos sem orientação médica.');
    }
    
    if (lowerText.includes('há dias') || lowerText.includes('há semanas')) {
      warnings.push('📅 Sintomas persistentes devem ser avaliados por um médico.');
    }
    
    if (lowerText.includes('dor') && (lowerText.includes('forte') || lowerText.includes('intensa'))) {
      warnings.push('⚠️ Dor intensa requer avaliação médica urgente.');
    }
    
    return warnings;
  }

  return {
    // Estados
    isConnected,
    isListening,
    isSpeaking,
    isProcessing,
    transcript,
    lastResponse,
    error,
    sessionId: sessionIdRef.current,
    
    // Ações
    connect,
    disconnect,
    startListening,
    stopListening,
    askQuestion,
    
    // Status
    isSupported: true, // Gemini Live sempre suportado via WebSocket
  };
}