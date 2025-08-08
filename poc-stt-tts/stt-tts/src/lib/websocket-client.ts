export interface AudioMessage {
  type: 'audio' | 'text' | 'connection' | 'response' | 'error' | 'init' | 'transcript';
  data?: any;
  sessionId?: string;
  timestamp?: string;
  config?: any;
  text?: string;
}

export class AudioWebSocketClient {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private sessionId: string;
  private isConnected = false;
  private onTranscriptReceived: ((transcript: string) => void) | null = null;
  private onAudioReceived: ((audioBlob: Blob) => void) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Callbacks
  setTranscriptHandler(handler: (transcript: string) => void) {
    this.onTranscriptReceived = handler;
  }

  setAudioHandler(handler: (audioBlob: Blob) => void) {
    this.onAudioReceived = handler;
  }

  setStatusHandler(handler: (status: string) => void) {
    this.onStatusChange = handler;
  }

  // Conectar ao servidor
  async connect(): Promise<boolean> {
    try {
      this.updateStatus('Conectando ao servidor...');
      
      // Usar localhost:8080 já que o navegador está acessando de fora do container
      const wsUrl = 'ws://localhost:8080';
      
      console.log('🔗 Conectando ao WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      
      // Aguardar conexão ou timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('⏰ Timeout na conexão WebSocket');
          reject(new Error('Timeout na conexão WebSocket'));
        }, 10000); // Increased timeout to 10 seconds
        
        this.ws!.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ WebSocket conectado em:', wsUrl);
          this.isConnected = true;
          this.updateStatus('Conectado ao servidor de áudio');
          resolve(true);
          
          // Enviar mensagem de inicialização
          this.sendMessage({
            type: 'init',
            sessionId: this.sessionId,
            config: {
              model: 'gemini-2.0-flash-lite',
              sampleRate: 48000
            },
            timestamp: new Date().toISOString()
          });
        };
        
        this.ws!.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ Erro no WebSocket:', error);
          console.error('❌ Detalhes do erro:', {
            type: (error as Event).type,
            target: (error as Event).target,
            isTrusted: (error as Event).isTrusted
          });
          reject(new Error('Falha na conexão WebSocket'));
        };
      });

      // Configurar handlers de mensagem
      this.ws!.onmessage = (event) => {
        try {
          const message: AudioMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Erro ao processar mensagem:', error);
        }
      };

      this.ws!.onclose = (event) => {
        console.log('🔌 WebSocket desconectado:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          timestamp: new Date().toISOString()
        });
        console.log('🔌 Detalhes da desconexão:', {
          readyState: this.ws?.readyState,
          isConnected: this.isConnected,
          sessionId: this.sessionId
        });
        this.isConnected = false;
        this.updateStatus('Desconectado do servidor');
      };

      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar:', error);
      this.updateStatus('Falha na conexão');
      return false;
    }
  }

  // Iniciar gravação
  async startRecording(): Promise<boolean> {
    console.log('🎤 startRecording chamado, isConnected:', this.isConnected, 'ws.readyState:', this.ws?.readyState);
    console.log('🔍 WebSocket details:', {
      wsExists: !!this.ws,
      wsReadyState: this.ws?.readyState,
      sessionId: this.sessionId
    });
    
    if (!this.isConnected) {
      console.error('❌ WebSocket não conectado');
      console.error('🔍 Estado atual:', {
        isConnected: this.isConnected,
        wsReadyState: this.ws?.readyState,
        wsExists: !!this.ws
      });
      
      // Tentar reconectar se o WebSocket foi perdido
      if (!this.ws) {
        console.log('🔄 WebSocket perdido, tentando reconectar...');
        const reconnected = await this.connect();
        if (reconnected) {
          console.log('✅ Reconectado com sucesso');
          return this.startRecording(); // Tentar novamente
        }
      }
      
      return false;
    }

    try {
      this.updateStatus('Solicitando acesso ao microfone...');
      
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.updateStatus('Microfone ativado, iniciando gravação...');

      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.sendAudioData(event.data);
        }
      };

      this.mediaRecorder.start(100); // Enviar dados a cada 100ms
      this.updateStatus('🎤 Gravando... Clique para parar');

      return true;
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error);
      this.updateStatus('Erro ao acessar microfone');
      return false;
    }
  }

  // Parar gravação
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.updateStatus('⏹️ Parando gravação...');
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.mediaRecorder = null;
  }

  // Enviar dados de áudio
  private sendAudioData(audioBlob: Blob): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      
      this.sendMessage({
        type: 'audio',
        data: Array.from(uint8Array),
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
    };
    reader.readAsArrayBuffer(audioBlob);
  }

  // Enviar mensagem de texto
  sendTextMessage(text: string): void {
    this.sendMessage({
      type: 'text',
      data: text,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  // Enviar mensagem genérica
  private sendMessage(message: AudioMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📤 Enviando mensagem:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket não está aberto para enviar mensagem:', message);
    }
  }

  // Processar mensagens recebidas
  private handleMessage(message: AudioMessage): void {
    console.log('📨 Mensagem recebida:', message.type, message);

    switch (message.type) {
      case 'connection':
        console.log('✅ Conexão confirmada:', message.data);
        this.updateStatus('Conectado e pronto para gravação');
        break;

      case 'transcript':
        if (message.text && this.onTranscriptReceived) {
          console.log('📝 Transcrição recebida:', message.text);
          this.onTranscriptReceived(message.text);
        }
        break;

      case 'text':
        if (message.data && this.onTranscriptReceived) {
          console.log('📝 Transcrição recebida:', message.data);
          this.onTranscriptReceived(message.data);
        }
        break;

      case 'response':
        if (message.data && this.onAudioReceived) {
          // Converter dados de áudio de volta para Blob
          const audioData = new Uint8Array(message.data);
          const audioBlob = new Blob([audioData], { type: 'audio/webm' });
          this.onAudioReceived(audioBlob);
        }
        break;

      case 'error':
        console.error('❌ Erro do servidor:', message.data);
        this.updateStatus(`Erro: ${message.data}`);
        break;

      default:
        console.log('📨 Mensagem desconhecida:', message);
    }
  }

  // Atualizar status
  private updateStatus(status: string): void {
    console.log('📊 Status:', status);
    
    // Rastrear mudanças no isConnected
    if (status.includes('Conectado') && !this.isConnected) {
      console.log('🔄 Mudando isConnected: false → true');
      this.isConnected = true;
    } else if (status.includes('Desconectado') && this.isConnected) {
      console.log('🔄 Mudando isConnected: true → false');
      this.isConnected = false;
    }
    
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  // Desconectar
  disconnect(): void {
    this.stopRecording();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.updateStatus('Desconectado');
  }

  // Verificar se está conectado
  get isConnectedToServer(): boolean {
    return this.isConnected;
  }
} 