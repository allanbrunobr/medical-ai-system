import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('langfuse-test')
export class LangfuseTest extends LitElement {
  @state() private testResults: string[] = [];
  @state() private isLoading = false;

  static styles = css`
    :host {
      display: block;
      margin: 20px 0;
      padding: 20px;
      background: rgba(31, 41, 55, 0.8);
      border-radius: 12px;
      border: 1px solid rgba(75, 85, 99, 0.5);
    }

    .container {
      color: white;
    }

    .title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #e5e7eb;
    }

    .button {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 500;
      transition: all 0.3s;
      border: none;
      cursor: pointer;
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .button-primary {
      background: #2563eb;
      color: white;
    }

    .button-primary:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .button-secondary {
      background: #4b5563;
      color: white;
    }

    .button-secondary:hover:not(:disabled) {
      background: #374151;
    }

    .button:disabled {
      background: #6b7280;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .results {
      margin-top: 1rem;
    }

    .results-title {
      font-size: 1.125rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #e5e7eb;
    }

    .results-container {
      background: rgba(17, 24, 39, 0.8);
      padding: 1rem;
      border-radius: 0.5rem;
      max-height: 240px;
      overflow-y: auto;
    }

    .result-item {
      font-size: 0.875rem;
      color: #d1d5db;
      margin-bottom: 0.25rem;
    }

    .info {
      margin-top: 1rem;
      font-size: 0.875rem;
      color: #9ca3af;
    }

    .info a {
      color: #60a5fa;
      text-decoration: none;
    }

    .info a:hover {
      text-decoration: underline;
    }

    .info code {
      background: rgba(55, 65, 81, 0.8);
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-family: monospace;
    }
  `;

  private addResult(message: string) {
    this.testResults = [...this.testResults, `${new Date().toLocaleTimeString()}: ${message}`];
  }

  private async testLangfuse() {
    this.isLoading = true;
    this.addResult('🧪 Iniciando teste do Langfuse...');

    try {
      // Verificar se estamos no cliente
      this.addResult(`📍 Executando no cliente: ${typeof window !== 'undefined'}`);
      
      // Verificar variáveis de ambiente
      const publicKey = import.meta.env.VITE_LANGFUSE_PUBLIC_KEY;
      const secretKey = import.meta.env.VITE_LANGFUSE_SECRET_KEY;
      const baseUrl = import.meta.env.VITE_LANGFUSE_BASE_URL;
      
      this.addResult(`🔑 Public Key: ${publicKey ? 'Configurada' : 'Não configurada'}`);
      this.addResult(`🔑 Secret Key: ${secretKey ? 'Configurada' : 'Não configurada'}`);
      this.addResult(`🌐 Base URL: ${baseUrl || 'https://cloud.langfuse.com'}`);

      if (!publicKey || !secretKey) {
        this.addResult('❌ Chaves do Langfuse não configuradas');
        return;
      }

      // Teste 1: Verificar se Langfuse está disponível
      this.addResult('📦 Tentando importar módulo Langfuse...');
      const langfuseModule = await import('langfuse');
      this.addResult('✅ Módulo Langfuse carregado com sucesso');

      // Teste 2: Inicializar Langfuse
      this.addResult('🔧 Inicializando Langfuse...');
      const langfuse = new langfuseModule.Langfuse({
        publicKey,
        secretKey,
        baseUrl: baseUrl || 'https://cloud.langfuse.com',
      });
      this.addResult('✅ Langfuse inicializado com sucesso');

      // Teste 3: Criar um trace simples
      this.addResult('📝 Criando trace de teste...');
      const sessionId = `test_${Date.now()}`;
      const trace = await langfuse.trace({
        name: 'Teste Langfuse Gemini Live',
        sessionId,
        tags: ['test', 'gemini-live'],
        metadata: {
          test_type: 'langfuse_integration',
          timestamp: new Date().toISOString(),
          session_id: sessionId,
        },
      });
      this.addResult('✅ Trace criado com sucesso');

      // Teste 4: Atualizar o trace
      this.addResult('📝 Atualizando trace...');
      await trace.update({
        input: { 
          test_message: 'Teste de integração Langfuse',
          environment: 'poc-gemini-live',
        },
        output: { 
          status: 'success', 
          message: 'Langfuse funcionando corretamente',
          timestamp: new Date().toISOString(),
        },
      });
      this.addResult('✅ Trace atualizado com sucesso');

      // Teste 5: Criar um score
      this.addResult('📊 Criando score...');
      await langfuse.score({
        name: 'test_score',
        value: 1.0,
        comment: 'Teste de score do Langfuse - Gemini Live',
      });
      this.addResult('✅ Score criado com sucesso');

      this.addResult('🎉 Todos os testes do Langfuse passaram!');
      this.addResult(`📊 Session ID: ${sessionId}`);
      this.addResult('📊 Verifique os traces em: https://cloud.langfuse.com');

    } catch (error: any) {
      this.addResult(`❌ Erro no teste: ${error.message}`);
      this.addResult(`🔍 Stack trace: ${error.stack}`);
      console.error('Erro no teste Langfuse:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private clearResults() {
    this.testResults = [];
  }

  render() {
    return html`
      <div class="container">
        <h3 class="title">🧪 Teste Langfuse</h3>
        
        <div>
          <button
            @click=${this.testLangfuse}
            ?disabled=${this.isLoading}
            class="button ${this.isLoading ? 'button-secondary' : 'button-primary'}"
          >
            ${this.isLoading ? '🔄 Testando...' : '🚀 Executar Testes'}
          </button>

          <button
            @click=${this.clearResults}
            class="button button-secondary"
          >
            🗑️ Limpar Resultados
          </button>
        </div>

        ${this.testResults.length > 0 ? html`
          <div class="results">
            <h4 class="results-title">Resultados:</h4>
            <div class="results-container">
              ${this.testResults.map((result, index) => html`
                <div class="result-item" key=${index}>
                  ${result}
                </div>
              `)}
            </div>
          </div>
        ` : ''}

        <div class="info">
          <p>📊 Verifique os traces em: <a href="https://cloud.langfuse.com" target="_blank" rel="noopener noreferrer">Langfuse Dashboard</a></p>
          <p>🔍 Procure por traces com tags: <code>test</code>, <code>gemini-live</code></p>
        </div>
      </div>
    `;
  }
} 