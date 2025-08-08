"use client";
import React, { useRef, useState } from "react";
import LangfuseTest from '../components/LangfuseTest';
import { LangTraceService } from '../lib/langtrace-service';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [geminiResponse, setGeminiResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  const langTraceRef = useRef<LangTraceService | null>(null);

  // Inicializar LangTrace quando o componente montar
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🏁 Inicializando LangTraceService...');
      langTraceRef.current = new LangTraceService(`session_${Date.now()}`);
      console.log('✅ LangTraceService inicializado:', langTraceRef.current);
    }
  }, []);

  // Simulação: campo de texto para colar a transcrição (STT futuro)
  const handleTranscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscript(e.target.value);
  };

  // Envia a transcrição para o pipeline médico
  const handleRunPipeline = async () => {
    console.log('🚀 Iniciando pipeline médico...');
    console.log('🔍 LangTrace disponível:', !!langTraceRef.current);

    if (!langTraceRef.current) {
      console.log('❌ LangTrace não disponível');
      return;
    }

    setLoading(true);
    setError("");
    setPipelineResult(null);
    setGeminiResponse("");

    const startTime = Date.now();

    try {
      console.log('📝 Rastreando início da requisição...');
      // Rastrear início da requisição
      await langTraceRef.current.traceFrontendRequest(
        '/api/medical/pipeline',
        { transcript },
        { status: 'processing' },
        Date.now() - startTime
      );

      console.log('🌐 Fazendo requisição para /api/medical/pipeline...');
      const response = await fetch("/api/medical/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript })
      });
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      console.log('📊 Resposta do pipeline:', data.success ? 'SUCESSO' : 'ERRO');

      if (data.success) {
        setPipelineResult(data.result);
        
        console.log('📝 Rastreando performance do pipeline...');
        // Rastrear resposta do pipeline
        await langTraceRef.current.tracePipelinePerformance(
          transcript,
          data.result,
          responseTime
        );

        console.log('📝 Rastreando busca no Elasticsearch...');
        // Rastrear busca no Elasticsearch
        if (data.result.elasticsearchResults) {
          await langTraceRef.current.traceElasticsearchSearch(
            data.result.entities?.english_query || transcript,
            data.result.elasticsearchResults,
            responseTime
          );
        }

        console.log('📝 Rastreando busca no PubMed...');
        // Rastrear busca no PubMed
        if (data.result.pubmedPapers) {
          await langTraceRef.current.tracePubMedSearch(
            data.result.entities?.english_query || transcript,
            data.result.pubmedPapers,
            responseTime
          );
        }

        console.log('🤖 Chamando Gemini automaticamente...');
        // Automaticamente chama o Gemini com o contexto
        await callGemini(data.result);
      } else {
        setError(data.error || "Erro desconhecido");
        
        console.log('❌ Rastreando erro do pipeline...');
        // Rastrear erro
        await langTraceRef.current.traceError(
          new Error(data.error || "Erro desconhecido"),
          'pipeline-request'
        );
      }
    } catch (err: any) {
      setError(err.message || "Erro ao chamar pipeline");
      
      console.log('❌ Rastreando erro geral...');
      // Rastrear erro
      if (langTraceRef.current) {
        await langTraceRef.current.traceError(err, 'pipeline-request');
      }
    } finally {
      setLoading(false);
    }
  };

  // Chama o Gemini com o contexto enriquecido
  const callGemini = async (context: any) => {
    console.log('🤖 Iniciando chamada do Gemini...');
    console.log('🔍 LangTrace disponível:', !!langTraceRef.current);

    if (!langTraceRef.current) {
      console.log('❌ LangTrace não disponível para Gemini');
      return;
    }

    setGeminiLoading(true);
    setError("");

    const startTime = Date.now();

    try {
      console.log('📝 Rastreando início da requisição do Gemini...');
      // Rastrear início da requisição do Gemini
      await langTraceRef.current.traceFrontendRequest(
        '/api/gemini',
        { context_length: JSON.stringify(context).length },
        { status: 'processing' },
        Date.now() - startTime
      );

      console.log('🌐 Fazendo requisição para /api/gemini...');
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context })
      });
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      console.log('📊 Resposta do Gemini:', data.success ? 'SUCESSO' : 'ERRO');

      if (data.success) {
        setGeminiResponse(data.answer);
        
        console.log('📝 Rastreando resposta do Gemini...');
        // Rastrear resposta do Gemini
        await langTraceRef.current.traceGeminiResponse(
          `Análise médica para: ${transcript}`,
          data.answer,
          data.model || 'gemini-2.0-flash-lite',
          responseTime,
          data.answer.length
        );

        console.log('📝 Rastreando sessão completa...');
        // Rastrear sessão completa
        await langTraceRef.current.traceConversationSession({
          total_time_ms: responseTime,
          entities_found: context.entities?.conditions?.length || 0,
          symptoms_found: context.entities?.symptoms?.length || 0,
          elasticsearch_results: context.elasticsearchResults?.length || 0,
          pubmed_papers: context.pubmedPapers?.length || 0,
          synthesis_length: context.synthesis?.length || 0,
          gemini_response_length: data.answer.length,
        });

      } else {
        setError(`Erro no Gemini: ${data.error}`);
        
        console.log('❌ Rastreando erro do Gemini...');
        // Rastrear erro
        await langTraceRef.current.traceError(
          new Error(`Gemini error: ${data.error}`),
          'gemini-request'
        );
      }
    } catch (err: any) {
      setError(`Erro ao chamar Gemini: ${err.message}`);
      
      console.log('❌ Rastreando erro geral do Gemini...');
      // Rastrear erro
      if (langTraceRef.current) {
        await langTraceRef.current.traceError(err, 'gemini-request');
      }
    } finally {
      setGeminiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 mb-6">
          Afya Voice Medical Assistant
        </h1>
        <p className="text-lg text-gray-300 mb-8">
          Grave sua voz, cole a transcrição abaixo e execute o pipeline médico completo.
        </p>
        {/* Simulação do STT: campo de texto */}
        <textarea
          className="w-full min-h-[80px] rounded-lg p-3 text-lg mb-4 bg-white/10 text-white border border-white/20"
          placeholder="Cole aqui a transcrição do áudio (STT) ou digite um caso clínico..."
          value={transcript}
          onChange={handleTranscriptChange}
        />
        <button
          onClick={handleRunPipeline}
          disabled={!transcript || loading}
          className={`px-8 py-4 rounded-full shadow-lg text-white font-semibold text-xl transition-all duration-300 flex items-center gap-3 ${loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? "Processando..." : "Executar Pipeline Médico"}
        </button>
        {error && <div className="mt-4 text-red-400">{error}</div>}
        {pipelineResult && (
          <div className="mt-8 bg-white/10 rounded-xl p-6 border border-white/20 text-left">
            <h2 className="text-white font-semibold mb-2">Contexto Médico Enriquecido:</h2>
            <pre className="text-gray-100 text-sm whitespace-pre-wrap break-all max-h-[400px] overflow-auto">
              {JSON.stringify(
                (() => {
                  const { embedding, elasticsearchResults, ...rest } = pipelineResult;
                  return rest;
                })(),
                null,
                2
              )}
            </pre>
            <div className="mt-4 text-green-300 font-semibold">✅ Contexto enviado ao Gemini!</div>
          </div>
        )}

        {geminiLoading && (
          <div className="mt-6 bg-blue-500/20 rounded-xl p-4 border border-blue-300/30">
            <div className="flex items-center gap-3 text-blue-300">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-300"></div>
              <span className="font-semibold">🤖 Gemini analisando o contexto...</span>
            </div>
          </div>
        )}

        {geminiResponse && (
          <div className="mt-6 bg-green-500/20 rounded-xl p-6 border border-green-300/30 text-left">
            <h2 className="text-green-300 font-semibold mb-3 flex items-center gap-2">
              🤖 Resposta do Gemini
            </h2>
            <div className="text-white text-lg leading-relaxed whitespace-pre-wrap">
              {geminiResponse}
            </div>
            <div className="mt-4 text-green-200 text-sm">
              💡 Esta resposta foi gerada pelo modelo {process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash-lite'}
              baseada no contexto médico enriquecido.
            </div>
          </div>
        )}

        {/* Componente de teste do Langfuse */}
        <div className="mt-8">
          <LangfuseTest />
        </div>
      </div>
    </div>
  );
}