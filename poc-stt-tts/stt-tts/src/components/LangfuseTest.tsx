"use client";
import React, { useState, useEffect } from 'react';

export default function LangfuseTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testLangfuse = async () => {
    if (!isClient) {
      addResult('❌ Não estamos no cliente');
      return;
    }

    setIsLoading(true);
    addResult('🧪 Iniciando teste do Langfuse...');

    try {
      // Verificar se estamos no cliente
      addResult(`📍 Executando no cliente: ${typeof window !== 'undefined'}`);
      
      // Verificar variáveis de ambiente
      const publicKey = process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY;
      const secretKey = process.env.NEXT_PUBLIC_LANGFUSE_SECRET_KEY;
      const baseUrl = process.env.LANGFUSE_BASE_URL;
      
      addResult(`🔑 Public Key: ${publicKey ? 'Configurada' : 'Não configurada'}`);
      addResult(`🔑 Secret Key: ${secretKey ? 'Configurada' : 'Não configurada'}`);
      addResult(`🌐 Base URL: ${baseUrl || 'https://cloud.langfuse.com'}`);

      if (!publicKey || !secretKey) {
        addResult('❌ Chaves do Langfuse não configuradas');
        return;
      }

      // Teste 1: Verificar se Langfuse está disponível
      addResult('📦 Tentando importar módulo Langfuse...');
      const langfuseModule = await import('langfuse');
      addResult('✅ Módulo Langfuse carregado com sucesso');

      // Teste 2: Inicializar Langfuse
      addResult('🔧 Inicializando Langfuse...');
      const langfuse = new langfuseModule.Langfuse({
        publicKey,
        secretKey,
        baseUrl: baseUrl || 'https://cloud.langfuse.com',
      });
      addResult('✅ Langfuse inicializado com sucesso');

      // Teste 3: Criar um trace simples
      addResult('📝 Criando trace de teste...');
      const sessionId = `test_${Date.now()}`;
      const trace = await langfuse.trace({
        name: 'Teste Langfuse STT-TTS',
        sessionId,
        tags: ['test', 'stt-tts'],
        metadata: {
          test_type: 'langfuse_integration',
          timestamp: new Date().toISOString(),
          session_id: sessionId,
        },
      });
      addResult('✅ Trace criado com sucesso');

      // Teste 4: Atualizar o trace
      addResult('📝 Atualizando trace...');
      await trace.update({
        input: { 
          test_message: 'Teste de integração Langfuse',
          environment: 'poc-stt-tts',
        },
        output: { 
          status: 'success', 
          message: 'Langfuse funcionando corretamente',
          timestamp: new Date().toISOString(),
        },
      });
      addResult('✅ Trace atualizado com sucesso');

      // Teste 5: Criar um score
      addResult('📊 Criando score...');
      await langfuse.score({
        name: 'test_score',
        value: 1.0,
        comment: 'Teste de score do Langfuse - STT-TTS',
      });
      addResult('✅ Score criado com sucesso');

      addResult('🎉 Todos os testes do Langfuse passaram!');
      addResult(`📊 Session ID: ${sessionId}`);
      addResult('📊 Verifique os traces em: https://cloud.langfuse.com');

    } catch (error: any) {
      addResult(`❌ Erro no teste: ${error.message}`);
      addResult(`🔍 Stack trace: ${error.stack}`);
      console.error('Erro no teste Langfuse:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  if (!isClient) {
    return (
      <div className="mt-8 p-6 bg-gray-800 rounded-xl border border-gray-600">
        <h3 className="text-xl font-semibold text-white mb-4">🧪 Teste Langfuse</h3>
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mt-8 p-6 bg-gray-800 rounded-xl border border-gray-600">
      <h3 className="text-xl font-semibold text-white mb-4">🧪 Teste Langfuse</h3>
      
      <div className="space-y-4">
        <button
          onClick={testLangfuse}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isLoading 
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isLoading ? '🔄 Testando...' : '🚀 Executar Testes'}
        </button>

        <button
          onClick={clearResults}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          🗑️ Limpar Resultados
        </button>

        {testResults.length > 0 && (
          <div className="mt-4">
            <h4 className="text-lg font-medium text-white mb-2">Resultados:</h4>
            <div className="bg-gray-900 p-4 rounded-lg max-h-60 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm text-gray-300 mb-1">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-400">
          <p>📊 Verifique os traces em: <a href="https://cloud.langfuse.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Langfuse Dashboard</a></p>
          <p>🔍 Procure por traces com tags: <code className="bg-gray-700 px-1 rounded">test</code>, <code className="bg-gray-700 px-1 rounded">stt-tts</code></p>
        </div>
      </div>
    </div>
  );
} 