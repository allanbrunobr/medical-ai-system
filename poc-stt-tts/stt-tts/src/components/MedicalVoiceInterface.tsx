"use client";

import { useState, useEffect } from "react";
import { 
  Mic, MicOff, Volume2, VolumeX, Heart, AlertCircle, 
  MessageSquare, Clock, FileText, ChevronRight, X
} from "lucide-react";
import { useMedicalVoice } from "@/hooks/useMedicalVoice";
import { MedicalResponse } from "@/lib/medical-rag/types";
import { emergencyKeywords } from "@/lib/medical-rag/config";

interface ConversationEntry {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  warnings?: string[];
  confidence?: number;
}

export function MedicalVoiceInterface() {
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
  const [inputText, setInputText] = useState('');
  
  const {
    isListening,
    isSpeaking,
    isProcessing,
    transcript,
    lastResponse,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    askQuestion,
    isSupported,
  } = useMedicalVoice({
    autoSpeak: true,
    onResponse: (response: MedicalResponse) => {
      // Adiciona resposta à conversa
      addToConversation('assistant', response.answer, {
        warnings: response.warnings,
        confidence: response.confidence,
      });
    },
  });

  // Adiciona entrada à conversa
  const addToConversation = (
    type: 'user' | 'assistant', 
    text: string, 
    extra?: { warnings?: string[]; confidence?: number }
  ) => {
    const entry: ConversationEntry = {
      id: `${type}-${Date.now()}`,
      type,
      text,
      timestamp: new Date(),
      ...extra,
    };
    
    setConversation(prev => [...prev, entry]);
    
    // Verifica emergência
    if (type === 'user') {
      checkForEmergency(text);
    }
  };

  // Verifica palavras de emergência
  const checkForEmergency = (text: string) => {
    const lowerText = text.toLowerCase();
    const hasEmergency = emergencyKeywords.some(keyword => 
      lowerText.includes(keyword)
    );
    
    if (hasEmergency) {
      setShowEmergencyAlert(true);
      stopSpeaking(); // Para qualquer fala
    }
  };

  // Efeito para adicionar transcrição à conversa
  useEffect(() => {
    if (transcript && !isListening) {
      addToConversation('user', transcript);
    }
  }, [transcript, isListening]);

  // Envia pergunta por texto
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      addToConversation('user', inputText);
      askQuestion(inputText);
      setInputText('');
    }
  };

  // Tela de disclaimer inicial
  if (showDisclaimer) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-red-100 rounded-full">
              <Heart className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Assistente Médico por Voz
            </h1>
          </div>
          
          <div className="space-y-4 text-gray-700">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-900 mb-1">
                    Avisos Importantes:
                  </p>
                  <ul className="space-y-1 text-amber-800">
                    <li>• Este assistente fornece apenas informações educacionais</li>
                    <li>• Não substitui consulta com profissional de saúde</li>
                    <li>• Em emergências, procure atendimento médico imediato</li>
                    <li>• Suas perguntas podem ser gravadas para melhorar o serviço</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Como usar:</strong> Clique no microfone e faça sua pergunta 
                sobre saúde. O assistente responderá com informações baseadas em 
                conhecimento médico verificado.
              </p>
            </div>
            
            {!isSupported && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  ⚠️ Seu navegador não suporta reconhecimento de voz. 
                  Use Chrome, Edge ou Safari para melhor experiência.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => setShowDisclaimer(false)}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Entendi e Concordo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Alerta de emergência
  if (showEmergencyAlert) {
    return (
      <div className="fixed inset-0 bg-red-600 text-white flex items-center justify-center z-50 p-4">
        <div className="text-center max-w-2xl">
          <AlertCircle className="w-32 h-32 mx-auto mb-6 animate-pulse" />
          <h1 className="text-5xl font-bold mb-4">EMERGÊNCIA MÉDICA</h1>
          <p className="text-2xl mb-8">
            Procure atendimento médico imediato!
          </p>
          <div className="bg-white/20 rounded-2xl p-8 mb-8">
            <p className="text-3xl font-bold mb-4">Ligue agora:</p>
            <div className="text-6xl font-bold space-y-2">
              <div>SAMU: 192</div>
              <div>Bombeiros: 193</div>
            </div>
          </div>
          <button
            onClick={() => setShowEmergencyAlert(false)}
            className="px-8 py-4 bg-white text-red-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            Voltar ao Assistente
          </button>
        </div>
      </div>
    );
  }

  // Interface principal
  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-red-500" />
            <h1 className="text-lg font-semibold text-gray-900">
              Assistente Médico
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>Sessão ativa</span>
          </div>
        </div>
      </header>

      {/* Área de conversa */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {conversation.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                Faça uma pergunta sobre saúde usando o microfone ou digitando abaixo
              </p>
            </div>
          )}
          
          {conversation.map((entry) => (
            <div
              key={entry.id}
              className={`flex gap-3 ${
                entry.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  entry.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {entry.type === 'assistant' && (
                    <Heart className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={entry.type === 'user' ? 'text-white' : 'text-gray-800'}>
                      {entry.text}
                    </p>
                    
                    {entry.warnings && entry.warnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {entry.warnings.map((warning, idx) => (
                          <div key={idx} className="text-sm bg-amber-100 text-amber-800 rounded px-2 py-1">
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {entry.confidence !== undefined && (
                      <div className="mt-2 text-xs text-gray-500">
                        Confiança: {Math.round(entry.confidence * 100)}%
                      </div>
                    )}
                  </div>
                </div>
                
                <div className={`text-xs mt-1 ${
                  entry.type === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {entry.timestamp.toLocaleTimeString('pt-BR')}
                </div>
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex gap-3">
              <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center gap-2">
                <div className="animate-pulse flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                </div>
                <span className="text-sm text-gray-600">Processando...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Área de input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          
          <form onSubmit={handleTextSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Digite sua pergunta sobre saúde..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isProcessing}
              />
              
              {/* Botão de microfone dentro do input */}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessing || isSpeaking}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isListening ? (
                  <Mic className="w-5 h-5" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {/* Botão de enviar */}
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Enviar
              <ChevronRight className="w-4 h-4" />
            </button>
            
            {/* Botão de parar fala */}
            {isSpeaking && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <VolumeX className="w-5 h-5" />
              </button>
            )}
          </form>
          
          {/* Status */}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              {isListening && (
                <span className="flex items-center gap-1 text-red-600">
                  <Mic className="w-3 h-3 animate-pulse" />
                  Ouvindo...
                </span>
              )}
              {isSpeaking && (
                <span className="flex items-center gap-1 text-green-600">
                  <Volume2 className="w-3 h-3" />
                  Falando...
                </span>
              )}
            </div>
            <div>
              Esta informação é apenas educacional
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}