"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, AlertCircle, Heart, Volume2 } from "lucide-react";
import { emergencyKeywords, medicalSafetyConfig } from "@/lib/medical-rag/config";

interface MedicalVoiceAssistantProps {
  onQuery?: (query: string) => void;
  onEmergency?: () => void;
  patientId?: string;
}

export function MedicalVoiceAssistant({ 
  onQuery, 
  onEmergency,
  patientId 
}: MedicalVoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Clique para iniciar consulta por voz");
  const [isEmergency, setIsEmergency] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);

  // Detecta palavras-chave de emergência
  const checkEmergency = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    const hasEmergencyKeyword = emergencyKeywords.some(keyword => 
      lowerText.includes(keyword)
    );
    
    if (hasEmergencyKeyword) {
      setIsEmergency(true);
      if (onEmergency) onEmergency();
      
      // Para tudo e mostra alerta de emergência
      if (websocketRef.current) {
        websocketRef.current.send(JSON.stringify({
          type: 'emergency',
          sessionId: sessionIdRef.current,
        }));
      }
    }
    
    return hasEmergencyKeyword;
  }, [onEmergency]);

  // Conecta ao servidor WebSocket do Gemini Live
  const connectToGeminiLive = async () => {
    try {
      setStatus("Conectando ao assistente médico...");
      
      // Em produção, isso seria um servidor WebSocket real
      const wsUrl = process.env.NEXT_PUBLIC_MEDICAL_WS_URL || 
        'ws://localhost:8080';
      
      websocketRef.current = new WebSocket(wsUrl);
      
      websocketRef.current.onopen = () => {
        setIsConnected(true);
        setStatus("Assistente médico conectado");
        
        // Envia configuração inicial
        websocketRef.current?.send(JSON.stringify({
          type: 'init',
          sessionId: sessionIdRef.current,
          patientId,
          config: {
            language: 'pt-BR',
            voice: 'Puck',
            medicalMode: true,
          }
        }));
      };
      
      websocketRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'transcript':
            setTranscript(data.text);
            checkEmergency(data.text);
            if (onQuery) onQuery(data.text);
            break;
            
          case 'audio':
            // Reproduz resposta em áudio
            playAudioResponse(data.audio);
            break;
            
          case 'response':
            // Mostra resposta textual também
            console.log('Resposta médica:', data.text);
            break;
            
          case 'error':
            console.error('Erro:', data.message);
            setStatus(`Erro: ${data.message}`);
            break;
        }
      };
      
      websocketRef.current.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        setStatus("Erro de conexão");
      };
      
      websocketRef.current.onclose = () => {
        setIsConnected(false);
        setStatus("Desconectado");
      };
      
    } catch (error) {
      console.error("Erro ao conectar:", error);
      setStatus("Erro ao conectar com assistente");
    }
  };

  // Reproduz resposta de áudio
  const playAudioResponse = async (audioData: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      // Decodifica base64 para ArrayBuffer
      const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      const decodedAudio = await audioContextRef.current.decodeAudioData(audioBuffer.buffer);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContextRef.current.destination);
      source.start();
      
    } catch (error) {
      console.error("Erro ao reproduzir áudio:", error);
    }
  };

  // Inicia/para gravação
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = async () => {
    if (!isConnected) {
      await connectToGeminiLive();
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Configura captura de áudio
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(256, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!isListening || !websocketRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Envia áudio para o servidor
        websocketRef.current.send(JSON.stringify({
          type: 'audio',
          audio: btoa(String.fromCharCode(...new Uint8Array(inputData.buffer))),
          sessionId: sessionIdRef.current,
        }));
      };
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      
      setIsListening(true);
      setStatus("Ouvindo... Fale sua pergunta médica");
      
    } catch (error) {
      console.error("Erro ao acessar microfone:", error);
      setStatus("Erro ao acessar microfone");
    }
  };

  const stopListening = () => {
    setIsListening(false);
    setStatus("Processando...");
    
    // Para a captura de áudio
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Inicia sessão com disclaimer
  const startSession = () => {
    setSessionStarted(true);
    // Mostra avisos obrigatórios
    alert(medicalSafetyConfig.mandatoryWarnings.start);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Interface de emergência
  if (isEmergency) {
    return (
      <div className="fixed inset-0 bg-red-600 text-white flex items-center justify-center z-50">
        <div className="text-center p-8">
          <AlertCircle className="w-24 h-24 mx-auto mb-4 animate-pulse" />
          <h1 className="text-4xl font-bold mb-4">EMERGÊNCIA MÉDICA</h1>
          <p className="text-2xl mb-8">
            Procure imediatamente um serviço de saúde ou ligue:
          </p>
          <div className="text-6xl font-bold space-y-2">
            <div>SAMU: 192</div>
            <div>Bombeiros: 193</div>
          </div>
          <button
            onClick={() => setIsEmergency(false)}
            className="mt-8 px-6 py-3 bg-white text-red-600 rounded-lg font-bold"
          >
            Cancelar Alerta
          </button>
        </div>
      </div>
    );
  }

  // Interface principal
  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!sessionStarted ? (
        // Tela inicial com avisos
        <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-8 h-8 text-red-500" />
            <h3 className="text-lg font-bold">Assistente Médico por Voz</h3>
          </div>
          
          <div className="text-sm text-gray-600 space-y-2 mb-4">
            <p className="font-medium">⚠️ Avisos Importantes:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Este é apenas um assistente informativo</li>
              <li>Não substitui consulta médica profissional</li>
              <li>Em emergências, procure atendimento imediato</li>
              <li>Suas perguntas serão gravadas para qualidade</li>
            </ul>
          </div>
          
          <button
            onClick={startSession}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Entendi e quero continuar
          </button>
        </div>
      ) : (
        // Interface de voz
        <div className="bg-white rounded-lg shadow-2xl p-4 min-w-[300px] max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={toggleListening}
              className={`p-4 rounded-full transition-all ${
                isListening 
                  ? "bg-red-500 animate-pulse" 
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white`}
            >
              {isListening ? (
                <Mic className="w-8 h-8" />
              ) : (
                <MicOff className="w-8 h-8" />
              )}
            </button>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                <span className="font-medium">Assistente Médico</span>
              </div>
              <div className="text-sm text-gray-600">{status}</div>
            </div>
            
            {isListening && (
              <Volume2 className="w-6 h-6 text-green-500 animate-pulse" />
            )}
          </div>
          
          {transcript && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Você disse:</span> "{transcript}"
              </p>
            </div>
          )}
          
          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            {medicalSafetyConfig.mandatoryWarnings.end}
          </div>
        </div>
      )}
    </div>
  );
}