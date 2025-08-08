/**
 * Cliente para conexão com Gemini Live via WebSocket
 */

export interface GeminiLiveConfig {
  wsUrl?: string;
  model?: string;
  language?: string;
  voice?: string;
  medicalMode?: boolean;
}

export interface GeminiLiveCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onAudio?: (audio: ArrayBuffer) => void;
  onAudioEnded?: () => void;
  onError?: (error: string) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private callbacks: GeminiLiveCallbacks;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private recognition: any = null; // SpeechRecognition
  private speechSynthesis: SpeechSynthesis | null = null;
  private audioChunks: Int16Array[] = [];
  private lastSendTime = 0;

  constructor(config: GeminiLiveConfig = {}, callbacks: GeminiLiveCallbacks = {}) {
    this.config = {
      wsUrl: config.wsUrl || 'ws://localhost:8080',
      model: config.model || 'gemini-2.0-flash',
      language: config.language || 'pt-BR',
      voice: config.voice || 'Puck',
      medicalMode: config.medicalMode ?? true,
      ...config
    };
    this.callbacks = callbacks;
  }

  // Conecta ao servidor WebSocket
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Conectando ao Gemini Live...');
        
        this.ws = new WebSocket(this.config.wsUrl!);
        
        this.ws.onopen = () => {
          console.log('WebSocket conectado');
          
          // Envia configuração inicial
          this.send({
            type: 'init',
            config: {
              model: this.config.model,
              language: this.config.language,
              voice: this.config.voice,
              medicalMode: this.config.medicalMode,
            }
          });
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };
        
        this.ws.onerror = (error) => {
          console.error('Erro WebSocket:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError('Erro de conexão WebSocket');
          }
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket desconectado');
          if (this.callbacks.onDisconnect) {
            this.callbacks.onDisconnect();
          }
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // Processa mensagens recebidas
  private handleMessage(data: any) {
    switch (data.type) {
      case 'connection':
        console.log('Conexão estabelecida:', data.message);
        if (this.callbacks.onConnect) {
          this.callbacks.onConnect();
        }
        break;
        
      case 'transcript':
        if (this.callbacks.onTranscript) {
          this.callbacks.onTranscript(data.text);
        }
        break;
        
      case 'response':
        if (this.callbacks.onResponse) {
          this.callbacks.onResponse(data.text);
        }
        break;
        
      case 'audio':
        if (data.audio) {
          console.log('🔊 Áudio recebido do servidor, reproduzindo...');
          const audioData = this.base64ToArrayBuffer(data.audio);
          
          // Chama callback se existir
          if (this.callbacks.onAudio) {
            this.callbacks.onAudio(audioData);
          }
          
          // Reproduz automaticamente e notifica quando terminar
          this.playAudio(audioData).then(() => {
            // Notifica que o áudio terminou
            if (this.callbacks.onAudioEnded) {
              this.callbacks.onAudioEnded();
            }
          });
        }
        break;
        
      case 'error':
        console.error('Erro do servidor:', data.message);
        if (this.callbacks.onError) {
          this.callbacks.onError(data.message);
        }
        break;
        
      default:
        console.log('Mensagem desconhecida:', data);
    }
  }

  // Inicia gravação de áudio real para envio ao servidor
  async startRecording(): Promise<void> {
    try {
      console.log('Iniciando gravação de áudio...');
      
      // Solicita acesso ao microfone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      // Cria contexto de áudio
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      
      // Cria fonte de áudio do stream
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Cria processador de script para capturar áudio
      const bufferSize = 4096;
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // Processa áudio em chunks
      this.processor.onaudioprocess = (event) => {
        if (!this.isRecording) return;
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Converte Float32Array para Int16Array (PCM 16-bit)
        const pcm16 = this.float32ToPCM16(inputData);
        
        // Acumula chunks de áudio
        this.audioChunks.push(pcm16);
        
        // Envia a cada 2-3 segundos de áudio para melhor transcrição
        const totalSamples = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const now = Date.now();
        
        // Envia quando tiver 2-3 segundos de áudio OU a cada 3 segundos
        if (totalSamples >= 48000 || (now - this.lastSendTime) > 3000) {
          this.sendAccumulatedAudio();
        }
      };
      
      // Conecta o pipeline de áudio
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      this.isRecording = true;
      this.audioChunks = []; // Limpa buffer anterior
      this.lastSendTime = Date.now();
      console.log('Gravação de áudio iniciada - enviando para Google Cloud Speech');
      
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      if (error.name === 'NotAllowedError') {
        throw new Error('Acesso ao microfone negado. Permita o acesso e tente novamente.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('Microfone não encontrado. Verifique se há um microfone conectado.');
      } else {
        throw new Error(`Erro ao acessar microfone: ${error.message}`);
      }
    }
  }

  // Envia áudio acumulado
  private sendAccumulatedAudio() {
    if (this.audioChunks.length === 0) return;
    
    // Combina todos os chunks em um array único
    const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Int16Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Converte para base64 e envia
    const audioBase64 = this.arrayBufferToBase64(combinedAudio.buffer);
    
    const durationSeconds = combinedAudio.length / 16000;
    console.log(`🎤 Enviando ${durationSeconds.toFixed(1)}s de áudio para transcrição...`);
    
    this.send({
      type: 'audio',
      audio: audioBase64,
      format: 'pcm16',
      sampleRate: 16000,
      channels: 1
    });
    
    // Limpa o buffer
    this.audioChunks = [];
    this.lastSendTime = Date.now();
  }

  // Para gravação
  stopRecording() {
    this.isRecording = false;
    
    // Envia qualquer áudio restante
    if (this.audioChunks.length > 0) {
      this.sendAccumulatedAudio();
    }
    
    // Limpa o pipeline de áudio
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    // Para o stream de mídia
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      this.mediaStream = null;
    }
    
    // Fecha o contexto de áudio
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('Gravação de áudio parada');
  }

  // Envia pergunta em texto
  sendText(text: string) {
    this.send({
      type: 'text',
      text: text,
    });
  }

  // Reproduz áudio recebido (MP3 do Google Cloud Text-to-Speech)
  private async playAudio(audioData: ArrayBuffer) {
    try {
      console.log('🎵 Iniciando reprodução de áudio...');
      
      // Cria contexto de áudio se não existir
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Resume contexto se necessário
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Decodifica o áudio MP3
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
      console.log(`🎵 Áudio decodificado: ${audioBuffer.duration.toFixed(1)}s`);
      
      // Cria fonte e reproduz
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      return new Promise<void>((resolve) => {
        source.onended = () => {
          console.log('🎵 Reprodução finalizada');
          this.isPlaying = false;
          resolve();
        };
        
        source.start(0);
        this.isPlaying = true;
        console.log('🎵 Reproduzindo áudio...');
      });
      
    } catch (error) {
      console.error('❌ Erro ao reproduzir áudio:', error);
      this.isPlaying = false;
      
      // Fallback: usa HTML5 Audio para MP3
      try {
        console.log('🔄 Tentando fallback com HTML5 Audio...');
        const blob = new Blob([audioData], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        return new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            this.isPlaying = false;
            resolve();
          };
          
          audio.onerror = () => {
            console.error('❌ Erro no fallback HTML5 Audio');
            URL.revokeObjectURL(url);
            this.isPlaying = false;
            resolve();
          };
          
          audio.play();
          this.isPlaying = true;
          console.log('🎵 Reproduzindo via HTML5 Audio...');
        });
        
      } catch (fallbackError) {
        console.error('❌ Erro no fallback:', fallbackError);
        this.isPlaying = false;
      }
    }
  }

  // Reproduz próximo áudio da fila
  private playNextInQueue() {
    if (this.audioQueue.length > 0) {
      const nextAudio = this.audioQueue.shift()!;
      // Reproduz próximo áudio
    } else {
      this.isPlaying = false;
    }
  }

  // Desconecta do servidor
  disconnect() {
    this.stopRecording();
    
    if (this.ws) {
      this.send({ type: 'close' });
      this.ws.close();
      this.ws = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Envia mensagem via WebSocket
  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // Utilitários de conversão
  private float32ToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}