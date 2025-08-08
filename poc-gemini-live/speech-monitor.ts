/**
 * Speech monitor that listens to user's speech and searches Elasticsearch
 * Runs in parallel with Gemini Live to provide medical context
 */

import { elasticsearchRAG } from './elasticsearch-rag';

export class SpeechMonitor {
  private recognition: any;
  private isListening = false;
  private onTranscript: ((transcript: string) => void) | null = null;
  private lastTranscript = '';
  private transcriptDebounceMs = 1000; // Wait 1 second for final transcript
  
  constructor() {
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('⚠️ Web Speech API not supported');
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'pt-BR';
    
    this.recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      
      if (event.results[current].isFinal) {
        console.log('🎙️ Final transcript:', transcript);
        
        // Send final transcript to callback
        if (this.onTranscript && transcript.trim() !== this.lastTranscript.trim()) {
          this.lastTranscript = transcript;
          this.onTranscript(transcript);
        }
      } else {
        console.log('🎤 Interim:', transcript);
      }
    };
    
    this.recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        console.log('🎤 Microphone permission denied for speech monitor');
      }
    };
    
    this.recognition.onend = () => {
      console.log('🔚 Speech recognition ended');
      // Restart if still listening
      if (this.isListening) {
        this.recognition.start();
      }
    };
  }
  
  start(onTranscript: (transcript: string) => void) {
    if (!this.recognition) {
      console.warn('⚠️ Speech recognition not available');
      return;
    }
    
    this.onTranscript = onTranscript;
    this.isListening = true;
    
    try {
      this.recognition.start();
      console.log('🎙️ Speech monitor started');
    } catch (error) {
      console.error('❌ Failed to start speech monitor:', error);
    }
  }
  
  stop() {
    if (!this.recognition) return;
    
    this.isListening = false;
    try {
      this.recognition.stop();
      console.log('🛑 Speech monitor stopped');
    } catch (error) {
      console.error('❌ Failed to stop speech monitor:', error);
    }
  }
  
  isActive() {
    return this.isListening;
  }
}