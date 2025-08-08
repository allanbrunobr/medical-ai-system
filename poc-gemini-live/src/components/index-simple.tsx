import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

@customElement('gdm-live-audio-simple')
export class GdmLiveAudioSimple extends LitElement {
  @state() status = 'Inicializando...';
  @state() isRecording = false;

  static styles = css`
    :host {
      display: block;
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      text-align: center;
    }

    .button {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 15px 30px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
      margin: 10px;
    }

    .button:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .status {
      margin: 20px 0;
      padding: 15px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.1);
    }
  `;

  constructor() {
    super();
    this.status = '✅ Componente Lit carregado com sucesso!';
  }

  private async testLangfuse() {
    try {
      this.status = '🔄 Testando Langfuse...';
      
      // Tentar importar o Langfuse
      const { langfuse } = await import('./langfuse-config.ts');
      
      if (langfuse) {
        this.status = '✅ Langfuse carregado com sucesso!';
      } else {
        this.status = '⚠️ Langfuse não inicializado';
      }
    } catch (error: any) {
      this.status = `❌ Erro no Langfuse: ${error.message}`;
      console.error('Erro no Langfuse:', error);
    }
  }

  private testBasic() {
    this.status = '✅ Teste básico funcionando!';
  }

  render() {
    return html`
      <div class="container">
        <h1>🎤 Gemini Live Doctor - Versão Simplificada</h1>
        <p>Componente Lit funcionando</p>
        
        <div class="status">
          ${this.status}
        </div>
        
        <button class="button" @click=${this.testLangfuse}>
          🧪 Testar Langfuse
        </button>
        
        <button class="button" @click=${this.testBasic}>
          🔧 Teste Básico
        </button>
        
        <button class="button" @click=${() => this.isRecording = !this.isRecording}>
          ${this.isRecording ? '⏹️ Parar' : '🎤 Gravar'}
        </button>
      </div>
    `;
  }
} 