"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

export function VoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Clique para falar");
  const [error, setError] = useState("");
  
  const recognitionRef = useRef<any>(null);

  // Processa o comando de voz e dispara eventos
  const processVoiceCommand = useCallback((command: string) => {
    const lowerCommand = command.toLowerCase();
    
    // Detecta comando de mudança de tema (mais flexível)
    if (lowerCommand.includes("tema") || lowerCommand.includes("cor") || 
        lowerCommand.includes("mude") || lowerCommand.includes("deixe") ||
        lowerCommand.includes("colorido") || lowerCommand.includes("bonito")) {
      
      const colorMap: Record<string, string> = {
        azul: "#3b82f6", blue: "#3b82f6",
        verde: "#10b981", green: "#10b981",
        vermelho: "#ef4444", red: "#ef4444", 
        laranja: "#f97316", orange: "#f97316",
        roxo: "#8b5cf6", purple: "#8b5cf6", violeta: "#8b5cf6",
        rosa: "#ec4899", pink: "#ec4899",
        amarelo: "#eab308", yellow: "#eab308",
        preto: "#1f2937", black: "#1f2937",
        branco: "#f8fafc", white: "#f8fafc",
        dourado: "#f59e0b", gold: "#f59e0b",
        prata: "#6b7280", silver: "#6b7280"
      };
      
      // Procura por cores específicas
      for (const [colorName, colorValue] of Object.entries(colorMap)) {
        if (lowerCommand.includes(colorName)) {
          window.dispatchEvent(new CustomEvent('voice-command', {
            detail: { action: 'setThemeColor', params: { themeColor: colorValue } }
          }));
          setStatus(`Tema mudado para ${colorName}!`);
          return;
        }
      }
      
      // Se não encontrou cor específica, usa uma cor aleatória
      const colors = Object.values(colorMap);
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      window.dispatchEvent(new CustomEvent('voice-command', {
        detail: { action: 'setThemeColor', params: { themeColor: randomColor } }
      }));
      setStatus("Tema mudado aleatoriamente!");
      return;
    }
    
    // Detecta comando de lembrete (mais flexível)
    if (lowerCommand.includes("lembrete") || lowerCommand.includes("lembrar") || 
        lowerCommand.includes("me lembre") || lowerCommand.includes("preciso lembrar") ||
        lowerCommand.includes("não esquecer")) {
      
      // Padrões mais flexíveis para extrair o lembrete
      let reminderText = "";
      
      const patterns = [
        /(?:lembrete|lembrar)\s+(?:de\s+)?(.+)/i,
        /me\s+lembre\s+(?:de\s+)?(.+)/i,
        /preciso\s+lembrar\s+(?:de\s+)?(.+)/i,
        /não\s+esquecer\s+(?:de\s+)?(.+)/i,
        /lembrar\s+(.+)/i
      ];
      
      for (const pattern of patterns) {
        const match = command.match(pattern);
        if (match && match[1]) {
          reminderText = match[1].trim();
          break;
        }
      }
      
      if (reminderText) {
        window.dispatchEvent(new CustomEvent('voice-command', {
          detail: { action: 'addReminder', params: { reminder: reminderText } }
        }));
        setStatus("Lembrete adicionado!");
        return;
      }
    }
    
    // Detecta comando de provérbio (mais flexível)
    if (lowerCommand.includes("provérbio") || lowerCommand.includes("ditado") ||
        lowerCommand.includes("frase") || lowerCommand.includes("crie") ||
        lowerCommand.includes("adicione") || lowerCommand.includes("inspiradora") ||
        lowerCommand.includes("motivacional") || lowerCommand.includes("sabedoria")) {
      
      // Extrai o contexto ou usa um genérico
      let proverbContext = "";
      
      const contextPatterns = [
        /(?:provérbio|ditado|frase)\s+(?:sobre\s+)?(.+)/i,
        /(?:crie|adicione)\s+(?:um|uma)?\s*(?:provérbio|frase|ditado)?\s*(?:sobre\s+)?(.+)/i,
        /(?:inspiradora|motivacional)\s+(?:sobre\s+)?(.+)/i
      ];
      
      for (const pattern of contextPatterns) {
        const match = command.match(pattern);
        if (match && match[1]) {
          proverbContext = match[1].trim();
          break;
        }
      }
      
      // Se não achou contexto específico, usa um genérico
      if (!proverbContext) {
        const topics = ["vida", "sucesso", "sabedoria", "tecnologia", "programação", "motivação"];
        proverbContext = topics[Math.floor(Math.random() * topics.length)];
      }
      
      window.dispatchEvent(new CustomEvent('voice-command', {
        detail: { action: 'addProverb', params: { proverb: `Provérbio sobre ${proverbContext}` } }
      }));
      setStatus("Provérbio adicionado!");
      return;
    }
    
    setStatus("Comando não reconhecido. Tente falar mais naturalmente!");
  }, []);

  // Inicia o reconhecimento de voz
  const startListening = useCallback(() => {
    // Limpa erros anteriores
    setError("");
    
    // Verifica suporte do navegador
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Seu navegador não suporta reconhecimento de voz");
      setStatus("Navegador não suportado");
      return;
    }

    try {
      // Cria nova instância se não existir
      if (!recognitionRef.current) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'pt-BR';
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.maxAlternatives = 1;
      }

      const recognition = recognitionRef.current;

      // Remove listeners antigos
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      recognition.onstart = () => {
        console.log("Reconhecimento iniciado");
        setIsListening(true);
        setStatus("Ouvindo...");
        setTranscript("");
        setError("");
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setTranscript(transcript);
        
        if (event.results[current].isFinal) {
          processVoiceCommand(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Erro no reconhecimento:", event);
        
        // Trata diferentes tipos de erro
        switch(event.error) {
          case 'network':
            setError("Erro de rede. Verifique sua conexão.");
            break;
          case 'not-allowed':
            setError("Permissão de microfone negada.");
            break;
          case 'no-speech':
            setError("Nenhuma fala detectada.");
            break;
          case 'aborted':
            setError("Reconhecimento cancelado.");
            break;
          default:
            setError(`Erro: ${event.error}`);
        }
        
        setStatus("Erro ao reconhecer voz");
        setIsListening(false);
      };

      recognition.onend = () => {
        console.log("Reconhecimento finalizado");
        setIsListening(false);
        if (!transcript && !error) {
          setStatus("Clique para falar novamente");
        }
      };

      // Inicia o reconhecimento
      recognition.start();
      
    } catch (err) {
      console.error("Erro ao iniciar reconhecimento:", err);
      setError("Erro ao iniciar reconhecimento");
      setStatus("Erro ao iniciar");
      setIsListening(false);
    }
  }, [processVoiceCommand, transcript, error]);

  // Para o reconhecimento
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Erro ao parar reconhecimento:", err);
      }
    }
    setIsListening(false);
  }, [isListening]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (err) {
          // Ignora erros no cleanup
        }
      }
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-3 max-w-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-3 rounded-full transition-all ${
              isListening 
                ? "bg-red-500 animate-pulse" 
                : "bg-blue-500 hover:bg-blue-600"
            } text-white`}
          >
            {isListening ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </button>
          
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Comandos de Voz
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {status}
            </div>
          </div>
        </div>
        
        {error && (
          <div className="text-xs text-red-500 dark:text-red-400">
            {error}
          </div>
        )}
        
        {transcript && (
          <div className="text-sm text-gray-600 dark:text-gray-300 italic">
            "{transcript}"
          </div>
        )}
        
        {!isListening && !error && (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div className="font-medium">Fale naturalmente:</div>
            <ul className="space-y-0.5 ml-2">
              <li>• "Deixe tudo colorido e bonito"</li>
              <li>• "Me lembre de comprar pão"</li>
              <li>• "Crie uma frase inspiradora"</li>
              <li>• "Quero um tema azul"</li>
              <li>• "Adicione um provérbio motivacional"</li>
            </ul>
            
            {/* Botão de teste para simular comandos */}
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="font-medium mb-1">Testar comandos:</div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => processVoiceCommand("Deixe tudo bem colorido")}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Colorido
                </button>
                <button
                  onClick={() => processVoiceCommand("Me lembre de fazer exercícios")}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Lembrete
                </button>
                <button
                  onClick={() => processVoiceCommand("Crie uma frase motivacional")}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Frase
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}