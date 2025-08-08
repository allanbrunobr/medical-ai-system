"use client";

import { useState, useEffect } from "react";
import { 
  Mic, MicOff, Volume2, Heart, AlertCircle, 
  Wifi, WifiOff, Loader2, Phone
} from "lucide-react";
import { useGeminiLiveMedical } from "@/hooks/useGeminiLiveMedical";
import { medicalSafetyConfig } from "@/lib/medical-rag/config";

interface ConversationEntry {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  warnings?: string[];
}

export function GeminiLiveMedicalInterface() {
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showEmergency, setShowEmergency] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  
  const {
    isConnected,
    isListening,
    isSpeaking,
    isProcessing,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
  } = useGeminiLiveMedical({
    onEmergency: () => {
      setShowEmergency(true);
    },
  });

  // Interface puramente de áudio - sem texto

  // Auto-conecta após aceitar disclaimer
  useEffect(() => {
    if (!showDisclaimer && !isConnected) {
      connect();
    }
  }, [showDisclaimer, isConnected, connect]);

  // Disclaimer inicial
  if (showDisclaimer) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Assistente Médico com IA
              </h1>
              <p className="text-gray-600 mt-1">Powered by Google Cloud AI</p>
            </div>
          </div>
          
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-amber-900 mb-2">
                  Informações Importantes
                </h3>
                <ul className="space-y-2 text-amber-800">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Este assistente usa IA para fornecer informações médicas educacionais</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Não substitui consulta com profissional de saúde qualificado</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Em emergências, procure atendimento médico imediato ou ligue 192/193</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Conversas podem ser processadas para melhorar o serviço</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowDisclaimer(false)}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
          >
            Entendi e Aceito os Termos
          </button>
        </div>
      </div>
    );
  }

  // Tela de emergência
  if (showEmergency) {
    return (
      <div className="fixed inset-0 bg-red-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Phone className="w-32 h-32 mx-auto mb-6 animate-bounce" />
          <h1 className="text-6xl font-bold mb-4">EMERGÊNCIA MÉDICA</h1>
          <p className="text-3xl mb-8">Procure ajuda imediatamente!</p>
          
          <div className="bg-white/20 backdrop-blur rounded-3xl p-8 mb-8">
            <p className="text-2xl mb-4">Ligue agora:</p>
            <div className="space-y-4 text-5xl font-bold">
              <div className="flex items-center justify-center gap-4">
                <Phone className="w-12 h-12" />
                <span>SAMU: 192</span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <Phone className="w-12 h-12" />
                <span>Bombeiros: 193</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowEmergency(false)}
            className="px-8 py-4 bg-white text-red-600 rounded-xl font-bold text-xl hover:bg-gray-100 transition-all"
          >
            Voltar ao Assistente
          </button>
        </div>
      </div>
    );
  }

  // Interface principal
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Assistente Médico IA
                </h1>
                <p className="text-sm text-gray-600">Google Cloud Speech</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Status de conexão */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span className="text-sm font-medium">Conectado</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span className="text-sm font-medium">Desconectado</span>
                  </>
                )}
              </div>
              
              {/* Botão de reconectar */}
              {!isConnected && (
                <button
                  onClick={connect}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Reconectar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Área visual de áudio */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="text-center">
          {/* Estado visual do assistente */}
          <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full mb-8 transition-all duration-500 ${
            isListening 
              ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-2xl animate-pulse' 
              : isSpeaking
                ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-2xl'
                : isProcessing
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl animate-spin'
                  : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg'
          }`}>
            {isListening ? (
              <Mic className="w-16 h-16 text-white" />
            ) : isSpeaking ? (
              <Volume2 className="w-16 h-16 text-white animate-pulse" />
            ) : isProcessing ? (
              <Loader2 className="w-16 h-16 text-white" />
            ) : (
              <Heart className="w-16 h-16 text-white" />
            )}
          </div>
          
          {/* Status textual */}
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {isListening 
              ? 'Ouvindo...' 
              : isSpeaking 
                ? 'Falando...'
                : isProcessing
                  ? 'Pensando...'
                  : 'Assistente Médico'
            }
          </h2>
          
          <p className="text-lg text-gray-600 max-w-md mx-auto mb-8">
            {isListening 
              ? 'Fale sua pergunta sobre saúde' 
              : isSpeaking 
                ? 'Reproduzindo resposta em áudio'
                : isProcessing
                  ? 'Processando sua pergunta...'
                  : 'Conversa 100% por voz - clique no microfone para começar'
            }
          </p>
          
          {/* Indicador de ondas sonoras quando ouvindo */}
          {isListening && (
            <div className="flex items-center justify-center gap-1 mb-8">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-500 rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.random() * 30}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '0.8s'
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Indicador de ondas sonoras quando falando */}
          {isSpeaking && (
            <div className="flex items-center justify-center gap-1 mb-8">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-green-500 rounded-full animate-bounce"
                  style={{
                    height: `${15 + Math.random() * 25}px`,
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Área de controles */}
      <div className="bg-white border-t shadow-2xl">
        <div className="max-w-4xl mx-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <div className="flex items-center justify-center gap-6">
            {/* Botão principal de microfone */}
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={!isConnected || isProcessing}
              className={`relative p-6 rounded-full transition-all transform hover:scale-105 ${
                isListening
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-2xl animate-pulse'
                  : isConnected
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl hover:shadow-2xl'
                    : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isListening ? (
                <MicOff className="w-8 h-8 text-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
              
              {isListening && (
                <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></span>
              )}
            </button>
            
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {isListening ? 'Clique para parar' : 'Clique para começar'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isConnected ? 'Google Cloud ativo' : 'Conectando...'}
              </p>
              {isListening && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  🎤 Ouvindo continuamente...
                </p>
              )}
            </div>
          </div>
          
          {/* Disclaimer */}
          <p className="text-center text-xs text-gray-500 mt-6">
            {medicalSafetyConfig.mandatoryWarnings.end}
          </p>
        </div>
      </div>
    </div>
  );
}