"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, AlertCircle, Heart, Volume2, Loader2 } from "lucide-react";

export function MedicalVoiceSTT() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("Clique no microfone para começar");
  const [textInput, setTextInput] = useState("");
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Conecta ao WebSocket
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🔌 WebSocket conectado');
      setIsConnected(true);
      setStatus("Conectado - Clique no microfone");
      
      // Inicializa sessão
      ws.send(JSON.stringify({
        type: 'init',
        config: { model: 'gemini-2.5-flash' }
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📥 Mensagem recebida:', data.type);
      
      switch (data.type) {
        case 'connection':
          setStatus(data.message);
          break;
          
        case 'transcript':
          setTranscript(data.text);
          setStatus("Transcrição recebida");
          break;
          
        case 'response':
          setResponse(data.text);
          setIsProcessing(false);
          setStatus("Resposta recebida");
          break;
          
        case 'audio':
          // Se não houver áudio, usa síntese do navegador
          if (!data.audio && response) {
            speakText(response);
          } else if (data.audio) {
            playAudioResponse(data.audio);
          }
          break;
          
        case 'error':
          console.error('❌ Erro:', data.message);
          setStatus(`Erro: ${data.message}`);
          setIsProcessing(false);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket erro:', error);
      setStatus("Erro de conexão");
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket desconectado');
      setIsConnected(false);
      setStatus("Desconectado");
    };

    return () => {
      ws.close();
    };
  }, []);

  // Síntese de voz usando Web Speech API
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      // Para qualquer fala anterior
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => {
        setStatus("Reproduzindo resposta...");
      };
      
      utterance.onend = () => {
        setStatus("Pronto para nova pergunta");
      };
      
      utterance.onerror = (error) => {
        console.error('❌ Erro na síntese de voz:', error);
        setStatus("Erro ao reproduzir áudio");
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      console.error('❌ Web Speech API não suportada');
      setStatus("Síntese de voz não disponível");
    }
  };

  // Reproduz áudio MP3
  const playAudioResponse = async (audioBase64: string) => {
    try {
      const audioBlob = base64ToBlob(audioBase64, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setStatus("Pronto para nova pergunta");
      };
      
      setStatus("Reproduzindo resposta...");
      await audio.play();
    } catch (error) {
      console.error('❌ Erro ao reproduzir áudio:', error);
      setStatus("Erro ao reproduzir áudio");
    }
  };

  // Converte base64 para Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Inicia gravação
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      // Configura MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToServer(audioBlob);
        
        // Para o stream
        stream.getTracks().forEach(track => track.stop());
      };

      // Inicia gravação
      mediaRecorder.start();
      setIsRecording(true);
      setStatus("Gravando... Fale sua pergunta");
      setTranscript("");
      setResponse("");
      
    } catch (error) {
      console.error('❌ Erro ao acessar microfone:', error);
      setStatus("Erro ao acessar microfone");
    }
  };

  // Para gravação
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setStatus("Processando áudio...");
    }
  };

  // Envia áudio para o servidor
  const sendAudioToServer = async (audioBlob: Blob) => {
    try {
      // Converte para base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (base64Audio && wsRef.current?.readyState === WebSocket.OPEN) {
          console.log('📤 Enviando áudio:', base64Audio.length, 'caracteres');
          
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64Audio
          }));
        }
      };
      
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('❌ Erro ao enviar áudio:', error);
      setStatus("Erro ao enviar áudio");
      setIsProcessing(false);
    }
  };

  // Envia mensagem de texto
  const sendTextMessage = () => {
    if (textInput.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
      setIsProcessing(true);
      setStatus("Processando...");
      setTranscript(textInput);
      setResponse("");
      
      wsRef.current.send(JSON.stringify({
        type: 'text',
        text: textInput
      }));
      
      setTextInput("");
    }
  };

  // Toggle gravação
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-8 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <div className="bg-slate-800/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 max-w-2xl w-full border border-slate-700">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="w-10 h-10 text-red-500" />
            <h1 className="text-3xl font-bold text-slate-100">
              Assistente Médico por Voz
            </h1>
          </div>
          <p className="text-blue-300 text-lg">
            Fale seus sintomas e receba orientações médicas
          </p>
        </div>

        {/* Status */}
        <div className="mb-8 text-center">
          <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium ${
            isConnected ? 'bg-green-600/80 text-green-100 border border-green-500' : 'bg-red-600/80 text-red-100 border border-red-500'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-300' : 'bg-red-300'
            } animate-pulse`} />
            {status}
          </div>
        </div>

        {/* Botão de gravação */}
        <div className="flex justify-center mb-6">
          <button
            onClick={toggleRecording}
            disabled={!isConnected || isProcessing}
            className={`relative p-8 rounded-full transition-all transform hover:scale-105 border-2 ${
              isRecording 
                ? 'bg-red-600 border-red-400 animate-pulse shadow-red-500/50' 
                : isProcessing
                ? 'bg-slate-600 border-slate-500 cursor-not-allowed'
                : 'bg-blue-600 border-blue-400 hover:bg-blue-700 shadow-blue-500/50'
            } shadow-2xl`}
          >
            {isProcessing ? (
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            ) : isRecording ? (
              <Mic className="w-12 h-12 text-white" />
            ) : (
              <MicOff className="w-12 h-12 text-white" />
            )}
          </button>
        </div>

        {/* Entrada de texto alternativa */}
        <div className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && textInput.trim() && !isProcessing) {
                  sendTextMessage();
                }
              }}
              placeholder="Ou digite seus sintomas aqui..."
              className="flex-1 px-4 py-3 bg-slate-700/80 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50"
              disabled={!isConnected || isProcessing}
            />
            <button
              onClick={sendTextMessage}
              disabled={!isConnected || isProcessing || !textInput.trim()}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium border border-cyan-500"
            >
              Enviar
            </button>
          </div>
        </div>

        {/* Transcrição */}
        {transcript && (
          <div className="mb-6 p-4 bg-slate-700/60 border border-slate-600 rounded-xl">
            <h3 className="text-sm font-medium text-blue-300 mb-2">Você disse:</h3>
            <p className="text-slate-100 text-base">{transcript}</p>
          </div>
        )}

        {/* Resposta */}
        {response && (
          <div className="p-4 bg-slate-700/60 border border-slate-600 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-5 h-5 text-green-400" />
              <h3 className="text-sm font-medium text-green-300">Resposta médica:</h3>
            </div>
            <p className="text-slate-100 whitespace-pre-wrap leading-relaxed">{response}</p>
          </div>
        )}

        {/* Aviso */}
        <div className="mt-8 p-4 bg-amber-600/80 rounded-xl border border-amber-500">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-200 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-100 font-medium">
              Este é um assistente educacional. Para diagnósticos e tratamentos, 
              sempre consulte um profissional de saúde qualificado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}