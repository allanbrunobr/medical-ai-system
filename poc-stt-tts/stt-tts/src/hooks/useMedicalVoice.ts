import { useState, useCallback, useRef, useEffect } from 'react';
import { MedicalResponse } from '@/lib/medical-rag/types';

interface UseMedicalVoiceOptions {
  patientId?: string;
  onResponse?: (response: MedicalResponse) => void;
  onError?: (error: string) => void;
  autoSpeak?: boolean; // Fala automaticamente as respostas
}

export function useMedicalVoice(options: UseMedicalVoiceOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);

  // Inicializa reconhecimento de voz
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'pt-BR';
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
      }
    }
  }, []);

  // Processa pergunta médica
  const processMedicalQuery = useCallback(async (text: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/medical/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          patientId: options.patientId,
          sessionId: sessionIdRef.current,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao processar pergunta');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setLastResponse(data.response.text);
        
        // Fala a resposta se autoSpeak estiver ativado
        if (options.autoSpeak) {
          speak(data.response.text);
        }
        
        // Callback com resposta completa
        if (options.onResponse) {
          options.onResponse({
            id: `resp-${Date.now()}`,
            queryId: `query-${Date.now()}`,
            answer: data.response.text,
            sources: [],
            confidence: data.response.confidence,
            warnings: data.response.warnings,
            disclaimer: 'Informação apenas educacional',
          });
        }
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      if (options.onError) {
        options.onError(errorMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [options]);

  // Inicia escuta
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Reconhecimento de voz não disponível');
      return;
    }
    
    // Para qualquer fala em andamento
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    setError(null);
    setTranscript('');
    
    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };
    
    recognitionRef.current.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setTranscript(transcript);
      
      if (event.results[current].isFinal) {
        // Processa a pergunta quando finalizada
        processMedicalQuery(transcript);
      }
    };
    
    recognitionRef.current.onerror = (event: any) => {
      console.error('Erro no reconhecimento:', event);
      setError(`Erro: ${event.error}`);
      setIsListening(false);
    };
    
    recognitionRef.current.onend = () => {
      setIsListening(false);
    };
    
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Erro ao iniciar reconhecimento:', err);
      setError('Erro ao iniciar reconhecimento');
    }
  }, [processMedicalQuery]);

  // Para escuta
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Fala texto
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // Cancela fala anterior
      window.speechSynthesis.cancel();
      
      synthRef.current = new SpeechSynthesisUtterance(text);
      synthRef.current.lang = 'pt-BR';
      synthRef.current.rate = 0.9; // Um pouco mais devagar
      synthRef.current.pitch = 1.0;
      
      synthRef.current.onstart = () => {
        setIsSpeaking(true);
      };
      
      synthRef.current.onend = () => {
        setIsSpeaking(false);
      };
      
      synthRef.current.onerror = (event) => {
        console.error('Erro na síntese de voz:', event);
        setIsSpeaking(false);
      };
      
      window.speechSynthesis.speak(synthRef.current);
    }
  }, []);

  // Para de falar
  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Envia pergunta por texto
  const askQuestion = useCallback((text: string) => {
    setTranscript(text);
    processMedicalQuery(text);
  }, [processMedicalQuery]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    // Estados
    isListening,
    isSpeaking,
    isProcessing,
    transcript,
    lastResponse,
    error,
    sessionId: sessionIdRef.current,
    
    // Ações
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    askQuestion,
    
    // Utilitários
    isSupported: !!(
      (typeof window !== 'undefined') && 
      (window.SpeechRecognition || (window as any).webkitSpeechRecognition) &&
      window.speechSynthesis
    ),
  };
}