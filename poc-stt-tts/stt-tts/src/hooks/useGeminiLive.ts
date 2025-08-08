import { useState, useCallback, useRef, useEffect } from "react";

interface UseGeminiLiveOptions {
  model?: string;
  voiceName?: string;
  onTranscript?: (text: string) => void;
  onAudioResponse?: (audio: ArrayBuffer) => void;
}

export function useGeminiLive(options: UseGeminiLiveOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Removido executeAction - não existe em CopilotContext
  // As actions devem ser chamadas diretamente pelos componentes que as registram

  // Processa comandos de voz e dispara eventos
  const processVoiceCommand = useCallback(async (command: string) => {
    console.log("Processando comando:", command);
    
    // Detecta e dispara eventos para as actions
    const lowerCommand = command.toLowerCase();
    
    // Comando para mudar tema
    if (lowerCommand.includes("tema") || lowerCommand.includes("cor")) {
      const colorMap: Record<string, string> = {
        azul: "#3b82f6",
        blue: "#3b82f6",
        verde: "#10b981",
        green: "#10b981",
        vermelho: "#ef4444",
        red: "#ef4444",
        laranja: "#f97316",
        orange: "#f97316",
        roxo: "#8b5cf6",
        purple: "#8b5cf6",
        rosa: "#ec4899",
        pink: "#ec4899",
        amarelo: "#eab308",
        yellow: "#eab308"
      };
      
      for (const [colorName, colorValue] of Object.entries(colorMap)) {
        if (lowerCommand.includes(colorName)) {
          // Dispara evento customizado
          window.dispatchEvent(new CustomEvent('voice-command', {
            detail: { action: 'setThemeColor', params: { themeColor: colorValue } }
          }));
          return `Tema mudado para ${colorName}`;
        }
      }
    }
    
    // Comando para adicionar lembrete
    if (lowerCommand.includes("lembrete") || lowerCommand.includes("lembrar")) {
      const reminderMatch = command.match(/(?:lembrete|lembrar)\s+(?:de\s+)?(.+)/i);
      if (reminderMatch) {
        window.dispatchEvent(new CustomEvent('voice-command', {
          detail: { action: 'addReminder', params: { reminder: reminderMatch[1] } }
        }));
        return `Lembrete adicionado: ${reminderMatch[1]}`;
      }
    }
    
    // Comando para adicionar provérbio
    if (lowerCommand.includes("provérbio") || lowerCommand.includes("ditado")) {
      const proverbMatch = command.match(/(?:provérbio|ditado)\s+(?:sobre\s+)?(.+)/i);
      if (proverbMatch) {
        window.dispatchEvent(new CustomEvent('voice-command', {
          detail: { action: 'addProverb', params: { proverb: proverbMatch[1] } }
        }));
        return `Provérbio adicionado: ${proverbMatch[1]}`;
      }
    }
    
    return "Comando não reconhecido. Tente: mudar tema, adicionar lembrete ou criar provérbio.";
  }, []);

  // Conecta ao microfone e inicia captura
  const startListening = useCallback(async () => {
    try {
      // Solicita permissão do microfone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Cria contexto de áudio
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Cria processador de áudio
      processorRef.current = audioContextRef.current.createScriptProcessor(256, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (!isListening) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Aqui enviariamos os dados de áudio para o Gemini Live via WebSocket
        // Por enquanto, vamos simular
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      setIsListening(true);
      setError(null);
      
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      setError("Não foi possível acessar o microfone");
    }
  }, [isListening]);

  // Para a captura de áudio
  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsListening(false);
  }, []);

  // Simula processamento de comando (em produção seria via WebSocket)
  const simulateCommand = useCallback(async (command: string) => {
    setTranscript(command);
    const response = await processVoiceCommand(command);
    
    // Notifica callback se fornecido
    if (options.onTranscript) {
      options.onTranscript(command);
    }
    
    return response;
  }, [processVoiceCommand, options]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isConnected,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    simulateCommand, // Para testes
  };
}