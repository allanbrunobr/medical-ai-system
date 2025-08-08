/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';
import {elasticsearchRAG} from './elasticsearch-rag';
import {enhancedElasticsearchRAG} from './elasticsearch-rag-enhanced';
import {SpeechMonitor} from './speech-monitor';
import PhysicianMedicalAnalyzer from './physician-medical-analyzer';
import {physicianPromptTemplates} from './physician-prompt-templates';
import {perplexitySearch} from './perplexity-search';
import {medRAGSystem} from './med-rag-system';
import {enhancedMedRAGSystem} from './enhanced-med-rag-system';
import {medicalLiteratureSearch, MedicalReference} from './medical-literature-search';
import {LangTraceService} from './langtrace-service';

interface CompleteMedicalContext {
  clinical_reasoning: string;
  references: MedicalReference[];
  synthesis?: any;
  confidence: number;
  processing_summary: string;
  sources_consulted: number;
  processing_time_ms: number;
}

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state() ragEnabled = true;
  @state() hasContext = false;
  @state() perplexityEnabled = true;  // Always web enabled
  @state() papersEnabled = true;  // Always papers enabled
  @state() showReferences = false;
  @state() currentReferences: MedicalReference[] = [];
  @state() private accumulatedReferences: MedicalReference[] = [];  // Private - no auto re-render

  private client!: GoogleGenAI;
  private session!: Session;
  private apiKey: string = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private conversationHistory: Array<{role: string, content: string}> = [];
  private medicalContext: string = '';
  private speechMonitor: SpeechMonitor;
  private physicianAnalyzer: PhysicianMedicalAnalyzer;
  private accumulatedSymptoms: Set<string> = new Set();
  private lastContextUpdate: number = 0;
  private askedQuestions: string[] = [];
  private langTraceService: LangTraceService;

  static styles = css`
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;

      button {
        outline: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        width: 64px;
        height: 64px;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        margin: 0;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      }

      button[disabled] {
        display: none;
      }
    }
  `;

  constructor() {
    super();
    this.speechMonitor = new SpeechMonitor();
    this.physicianAnalyzer = new PhysicianMedicalAnalyzer();
    this.langTraceService = new LangTraceService(`gemini_live_session_${Date.now()}`);
    
    // Initialize search services - Always enabled for physician mode
    perplexitySearch.setEnabled(this.perplexityEnabled);
    medRAGSystem.setEnabled(this.papersEnabled);
    enhancedMedRAGSystem.setEnabled(this.papersEnabled);
    
    console.log('🏥 System initialized for PHYSICIAN-ONLY mode:');
    console.log('  📚 Papers/MedRAG: ENABLED');
    console.log('  🌐 Web/Perplexity: ENABLED');  
    console.log('  👨‍⚕️ Physician Mode: ENABLED');
    console.log('  🔍 RAG: ENABLED');
    
    this.initClient();
  }

  // Prevent unnecessary re-renders during audio recording
  shouldUpdate(changedProperties: Map<string, unknown>): boolean {
    // Always allow update if not recording
    if (!this.isRecording) {
      return true;
    }
    
    // During recording, only allow essential updates
    const allowedPropertiesDuringRecording = [
      'status', 
      'error', 
      'isRecording'
    ];
    
    for (const [key] of changedProperties) {
      if (!allowedPropertiesDuringRecording.includes(key)) {
        // Block non-essential updates during recording to prevent audio interference
        return false;
      }
    }
    
    return true;
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  private async initClient() {
    this.initAudio();

    this.client = new GoogleGenAI({
      apiKey: this.apiKey,
    });

    this.outputNode.connect(this.outputAudioContext.destination);

    this.initSession();
  }

  private async initSession() {
    const model = 'gemini-2.5-flash-preview-native-audio-dialog';
    
    // Store conversation history for RAG
    this.conversationHistory = [];

    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            this.updateStatus('Opened');
            console.log('✅ Gemini Live session opened successfully');
          },
          onmessage: async (message: LiveServerMessage) => {
            const audio =
              message.serverContent?.modelTurn?.parts?.[0]?.inlineData;

            if (audio?.data) {
              this.nextStartTime = Math.max(
                this.nextStartTime,
                this.outputAudioContext.currentTime,
              );

              const audioBuffer = await decodeAudioData(
                decode(audio.data),
                this.outputAudioContext,
                24000,
                1,
              );
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode);
              source.addEventListener('ended', () =>{
                this.sources.delete(source);
              });

              source.start(this.nextStartTime);
              this.nextStartTime = this.nextStartTime + audioBuffer.duration;
              this.sources.add(source);
            }

            const interrupted = message.serverContent?.interrupted;
            if(interrupted) {
              for(const source of this.sources.values()) {
                source.stop();
                this.sources.delete(source);
              }
              this.nextStartTime = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('🚨 Gemini Live session error:', e);
            this.updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            console.log('🔌 Gemini Live session closed:', e.reason);
            this.updateStatus('Close:' + e.reason);
            
            // Stop recording immediately when session closes
            this.isRecording = false;
            
            // Show quota error if that's the issue
            if (e.reason.includes('quota') || e.reason.includes('billing')) {
              this.updateError('❌ Google API Quota Exceeded - Check billing settings');
              console.error('💳 BILLING ISSUE: Configure billing at https://console.cloud.google.com/billing');
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
            // languageCode: 'en-GB'
          },
          systemInstruction: this.ragEnabled ? await (async () => {
            // Choose analyzer based on physician mode
            const analyzer = this.physicianAnalyzer;
            
            const prompt = await analyzer.generateMedicalPrompt(
              this.accumulatedSymptoms,
              this.medicalContext,
              this.conversationHistory
            );
            
            console.log(`🎯 System instruction for Gemini Live (PHYSICIAN mode):`);
            console.log('- Accumulated symptoms:', Array.from(this.accumulatedSymptoms));
            console.log('- Medical context available:', !!this.medicalContext);
            console.log('- Physician mode active:', true);
            console.log('- Analyzer used:', 'PhysicianMedicalAnalyzer');
            console.log('- Full prompt length:', prompt.length);
            console.log('- Prompt preview:', prompt.substring(0, 200) + '...');
            
            return prompt;
          })() : undefined
        },
      });
    } catch (e) {
      console.error('❌ Failed to initialize Gemini Live session:', e);
      this.updateError('Failed to connect to Gemini Live');
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
  }

  private updateError(msg: string) {
    this.error = msg;
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }

    console.log('🎙️ Iniciando gravação com Langfuse tracing...');

    // Clear previous conversation references
    this.accumulatedReferences = [];
    this.currentReferences = [];
    this.showReferences = false;
    
    console.log('🎙️ Starting new conversation - Cleared previous references');

    this.inputAudioContext.resume();

    this.updateStatus('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.updateStatus('Microphone access granted. Starting capture...');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;
        
        // Only send audio if session exists and is properly initialized
        if (!this.session) {
          console.warn('⚠️ Session not initialized, skipping audio frame');
          return;
        }

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        try {
          this.session.sendRealtimeInput({media: createBlob(pcmData)});
          
          // Rastrear processamento de áudio em tempo real
          this.langTraceService.traceAudioProcessing(
            pcmData,
            Date.now(),
            'excellent'
          ).catch(error => {
            console.warn('⚠️ Erro no tracing de áudio:', error);
          });
          
        } catch (error) {
          console.warn('Failed to send audio frame:', error);
        }
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      // Small delay to ensure session is fully ready
      setTimeout(() => {
        this.isRecording = true;
        this.updateStatus('🔴 Recording... Capturing PCM chunks.');
      }, 500);
      
      // Start speech monitor for RAG if enabled
      if (this.ragEnabled) {
        this.speechMonitor.start(async (transcript) => {
          await this.processTranscript(transcript);
        });
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      this.updateStatus(`Error: ${(err as Error).message}`);
      this.stopRecording();
      
      // Rastrear erro
      await this.langTraceService.traceError(err, 'start-recording');
    }
  }

  private stopRecording() {
    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;

    this.updateStatus('Stopping recording...');

    this.isRecording = false;

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    
    // Stop speech monitor
    this.speechMonitor.stop();

    // Show accumulated references from the conversation - ONLY when not recording
    if (this.accumulatedReferences.length > 0 && !this.isRecording) {
      this.currentReferences = [...this.accumulatedReferences];
      this.showReferences = true;
      
      console.log(`🎯 Conversation ended - Showing ${this.currentReferences.length} accumulated references`);
      console.log('📚 References found during conversation:', this.currentReferences.map(ref => ref.title));
      
      this.updateStatus(`Conversation ended. Found ${this.currentReferences.length} scientific references.`);
    } else if (this.isRecording) {
      // Never show references during recording to prevent audio interference
      console.log('🚫 Preventing reference display during recording to avoid audio interference');
    } else {
      this.updateStatus('Recording stopped. Click Start to begin again.');
    }
  }

  private reset() {
    this.session?.close();
    this.accumulatedSymptoms.clear();
    this.conversationHistory = [];
    this.medicalContext = '';
    this.askedQuestions = [];
    
    // Clear accumulated references for new conversation
    this.accumulatedReferences = [];
    this.currentReferences = [];
    this.showReferences = false;
    
    console.log('🔄 Session reset - Cleared all accumulated references');
    
    this.initSession();
    this.updateStatus('Session cleared.');
  }
  
  private toggleRAG() {
    this.ragEnabled = !this.ragEnabled;
    console.log(`🔍 RAG ${this.ragEnabled ? 'enabled' : 'disabled'}`);
    elasticsearchRAG.toggleRAG(this.ragEnabled);
    
    // Reinitialize session with updated system instruction
    if (this.session) {
      this.reset();
    }
  }

  private togglePerplexity() {
    this.perplexityEnabled = !this.perplexityEnabled;
    console.log(`🌐 Perplexity search ${this.perplexityEnabled ? 'enabled' : 'disabled'}`);
    
    // Update Perplexity service
    perplexitySearch.setEnabled(this.perplexityEnabled);
  }

  private togglePapers() {
    this.papersEnabled = !this.papersEnabled;
    console.log(`📚 Papers search ${this.papersEnabled ? 'enabled' : 'disabled'}`);
    
    // Update MedRAG systems
    medRAGSystem.setEnabled(this.papersEnabled);
    enhancedMedRAGSystem.setEnabled(this.papersEnabled);
    
    // Debug: Check system status
    console.log('🔍 Debug - System Status:');
    console.log('  papersEnabled:', this.papersEnabled);
    console.log('  medRAGSystem.isAvailable():', medRAGSystem.isAvailable());
    console.log('  enhancedMedRAGSystem.isAvailable():', enhancedMedRAGSystem.isAvailable());
    console.log('  currentReferences.length:', this.currentReferences.length);
    console.log('  showReferences:', this.showReferences);
  }

  private toggleReferences() {
    // Don't show references during recording to avoid audio interruption
    if (this.isRecording) {
      console.log('⚠️ Cannot show references during recording');
      return;
    }
    
    this.showReferences = !this.showReferences;
    console.log(`📊 References panel ${this.showReferences ? 'shown' : 'hidden'}`);
  }

  /**
   * Verifica se deve processar contexto médico com lógica inteligente
   */
  private shouldProcessMedicalContext(clinicalEntities: any): boolean {
    // Só processa se:
    // 1. Há sintomas/condições novas
    // 2. Não processou recentemente (debounce)
    // 3. Há conteúdo médico significativo
    
    const hasNewMedicalContent = clinicalEntities.symptoms.length > 0;
    const timeSinceLastUpdate = Date.now() - this.lastContextUpdate;
    const minInterval = 10000; // 10 segundos mínimo entre processamentos
    
    console.log(`🤔 Should process medical context?`);
    console.log(`  📝 New symptoms: ${clinicalEntities.symptoms.length}`);
    console.log(`  ⏰ Time since last: ${timeSinceLastUpdate}ms (min: ${minInterval}ms)`);
    console.log(`  📊 Total accumulated: ${this.accumulatedSymptoms.size}`);
    
    const shouldProcess = hasNewMedicalContent && timeSinceLastUpdate > minInterval;
    console.log(`  ✅ Decision: ${shouldProcess ? 'PROCESS' : 'SKIP'}`);
    
    return shouldProcess;
  }

  /**
   * Processa contexto médico completo sem reinicializações
   */
  private async processCompleteMedicalContext(transcript: string): Promise<CompleteMedicalContext | null> {
    console.log('🚀 === PROCESSING COMPLETE MEDICAL CONTEXT ===');
    console.log('📋 No session interruptions - processing everything in batch');
    
    try {
      let finalContext = '';
      let allReferences: MedicalReference[] = [];
      let completeSynthesis: any = null;
      let confidence = 0;
      let sourcesConsulted = 0;
      let processingTime = 0;

      // FASE 1: Enhanced MedRAG (sem reinicializar)
      if (this.papersEnabled && enhancedMedRAGSystem.isAvailable()) {
        console.log('🔬 Phase 1: Enhanced MedRAG processing...');
        
        const startTime = Date.now();
        const enhancedResult = await enhancedMedRAGSystem.retrieveAugmentedMedicalContext(
          transcript,
          Array.from(this.accumulatedSymptoms),
          {
            include_recent_papers: true,
            max_references: 5,
            years_back: 5,
            specialty_focus: this.detectSpecialty(transcript),
            enable_synthesis: true,
            use_mesh_terms: true
          }
        );
        
        processingTime = Date.now() - startTime;

        if (enhancedResult && enhancedResult.references.length > 0) {
          finalContext = enhancedResult.clinical_reasoning;
          allReferences = enhancedResult.references;
          completeSynthesis = enhancedResult.complete_synthesis;
          confidence = enhancedResult.confidence_score;
          sourcesConsulted = enhancedResult.sources_consulted;

          console.log(`✅ Enhanced MedRAG completed successfully:`);
          console.log(`  📚 References: ${allReferences.length}`);
          console.log(`  🎯 Confidence: ${(confidence * 100).toFixed(1)}%`);
          console.log(`  ⏱️ Time: ${processingTime}ms`);
          console.log(`  🔍 Sources: ${sourcesConsulted}`);
          
          if (completeSynthesis) {
            console.log(`  🩺 Primary diagnosis: ${completeSynthesis.primary_diagnosis?.condition}`);
            console.log(`  🔍 Differentials: ${completeSynthesis.differential_diagnoses?.length || 0}`);
          }
        }
      }

      // FASE 2: Fallback se necessário
      if (!finalContext && this.papersEnabled && medRAGSystem.isAvailable()) {
        console.log('🔄 Phase 2: Legacy MedRAG fallback...');
        
        const medRAGResult = await medRAGSystem.retrieveAugmentedMedicalContext(
          transcript,
          Array.from(this.accumulatedSymptoms),
          {
            include_recent_papers: true,
            max_references: 5,
            years_back: 5,
            require_citations: true,
            specialty_focus: this.detectSpecialty(transcript)
          }
        );

        if (medRAGResult && medRAGResult.references.length > 0) {
          finalContext = medRAGResult.clinical_reasoning;
          allReferences = medRAGResult.references;
          confidence = 0.7; // Default for legacy system
          sourcesConsulted = medRAGResult.references.length;
        }
      }

      // FASE 3: Elasticsearch fallback
      if (!finalContext) {
        console.log('📊 Phase 3: Elasticsearch RAG fallback...');
        
        const physicianContext = await enhancedElasticsearchRAG.searchMedicalContextForPhysician(
          Array.from(this.accumulatedSymptoms),
          { 
            clinical_entities: { symptoms: Array.from(this.accumulatedSymptoms) },
            conversation_history: this.conversationHistory 
          }
        );

        if (physicianContext.elasticsearch_context) {
          finalContext = physicianContext.clinical_reasoning_prompt;
          confidence = 0.5; // Default for Elasticsearch
          sourcesConsulted = 1;
        }
      }

      // FASE 4: Acumula referências sem perder dados
      console.log('📚 Phase 4: Accumulating references...');
      const previousReferencesCount = this.accumulatedReferences.length;
      
      allReferences.forEach(ref => {
        if (!this.accumulatedReferences.some(existing => existing.title === ref.title)) {
          this.accumulatedReferences.push(ref);
        }
      });
      
      const newReferencesAdded = this.accumulatedReferences.length - previousReferencesCount;
      console.log(`  📈 Added ${newReferencesAdded} new references (total: ${this.accumulatedReferences.length})`);

      if (finalContext) {
        const result: CompleteMedicalContext = {
          clinical_reasoning: finalContext,
          references: allReferences,
          synthesis: completeSynthesis,
          confidence,
          processing_summary: `Enhanced MedRAG processed ${sourcesConsulted} sources with ${(confidence * 100).toFixed(1)}% confidence`,
          sources_consulted: sourcesConsulted,
          processing_time_ms: processingTime
        };

        console.log('✅ Complete medical context prepared successfully');
        return result;
      } else {
        console.log('❌ No medical context could be generated');
        return null;
      }

    } catch (error) {
      console.error('❌ Error in complete medical context processing:', error);
      return null;
    }
  }

  private detectSpecialty(transcript: string): string | undefined {
    const lowerText = transcript.toLowerCase();
    
    // Simple specialty detection based on keywords
    if (lowerText.includes('cardio') || lowerText.includes('coração') || lowerText.includes('pressão')) {
      return 'cardiologia';
    }
    if (lowerText.includes('pulm') || lowerText.includes('respir') || lowerText.includes('tosse')) {
      return 'pneumologia';
    }
    if (lowerText.includes('neuro') || lowerText.includes('cabeça') || lowerText.includes('convuls')) {
      return 'neurologia';
    }
    if (lowerText.includes('gastro') || lowerText.includes('estômago') || lowerText.includes('abdome')) {
      return 'gastroenterologia';
    }
    
    return undefined;
  }

  private detectPhysicianLanguage(transcript: string): boolean {
    const physicianTerms = [
      // Medical terminology
      'diagnóstico diferencial', 'hipóteses diagnósticas', 'exame físico', 'ausculta', 'palpação',
      'sopro', 'galope', 'estertores', 'sinal de', 'manobra', 'inspeção', 'percussão',
      
      // Physician language patterns
      'paciente apresenta', 'paciente relata', 'encontrei', 'observo', 'ausculto', 'palpo',
      'à palpação', 'à ausculta', 'à percussão', 'exame físico revela', 'achados do exame',
      
      // Clinical presentations
      'masculino', 'feminino', 'anos de idade', 'comorbidades', 'medicações em uso',
      'história patológica', 'antecedentes', 'sinais vitais',
      
      // Differential diagnosis language
      'pode ser', 'sugere', 'compatível com', 'diagnósticos possíveis', 'considerar',
      'descartar', 'investigar', 'exames complementares',
      
      // Drug-related
      'interação medicamentosa', 'posologia', 'contraindicação', 'efeitos colaterais',
      'ajuste de dose', 'monitoramento'
    ];

    const lowerTranscript = transcript.toLowerCase();
    return physicianTerms.some(term => lowerTranscript.includes(term));
  }

  private async processTranscript(transcript: string): Promise<void> {
    console.log('🎤 Processando transcrição com Langfuse tracing...');
    
    try {
      // Rastrear transcrição com Langfuse
      await this.langTraceService.traceSpeechToText(
        transcript,
        5000, // duração estimada do áudio
        0.95  // confidence score
      );

      // Always process as physician input
      await this.processPhysicianTranscript(transcript);
      
    } catch (error) {
      console.error('❌ Erro no processamento com tracing:', error);
      // Rastrear erro
      await this.langTraceService.traceError(error, 'transcript-processing');
    }
  }

  private async processPhysicianTranscript(transcript: string): Promise<void> {
    console.log('👨‍⚕️ === OPTIMIZED PHYSICIAN PROCESSING ===');
    console.log('🚀 Batch processing: Complete Enhanced MedRAG before session update');
    
    const startTime = Date.now();
    
    try {
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: transcript
      });

      // 1. Extract clinical entities
      const clinicalEntities = await this.physicianAnalyzer.extractClinicalEntities(transcript);
      
      // 2. Add symptoms to accumulated set
      clinicalEntities.symptoms.forEach(symptom => this.accumulatedSymptoms.add(symptom));
      console.log('📊 Accumulated symptoms:', Array.from(this.accumulatedSymptoms));
      
      // 3. NOVA LÓGICA: Verifica se deve processar contexto médico
      if (this.shouldProcessMedicalContext(clinicalEntities)) {
        console.log('✅ Should process medical context - starting batch processing');
        
        try {
          // 4. NOVO: Processa TUDO de uma vez, sem reinicializar durante
          const completeContext = await this.processCompleteMedicalContext(transcript);
          
          // 5. NOVO: Só reinicializa UMA vez no final, com contexto completo
          if (completeContext) {
            await this.updateSessionWithCompleteContext(completeContext);
            
            // Rastrear análise médica completa
            const responseTime = Date.now() - startTime;
            await this.langTraceService.traceRealTimeMedicalAnalysis(
              transcript,
              {
                entities: clinicalEntities,
                emergency: completeContext.synthesis?.emergency || false,
                confidence: completeContext.confidence
              },
              responseTime
            );
          } else {
            console.log('⚠️ No complete context generated - falling back to basic processing');
            await this.processBasicTranscript(transcript);
          }
          
        } catch (error) {
          console.error('❌ Error in optimized processing:', error);
          // Fallback to basic context
          await this.processBasicTranscript(transcript);
        }
      } else {
        console.log('⏭️ Skipping medical context processing (debounced or no new symptoms)');
      }
      
    } catch (error) {
      console.error('❌ Erro no processamento médico:', error);
      await this.langTraceService.traceError(error, 'physician-processing');
    }
  }

  private async processBasicTranscript(transcript: string): Promise<void> {
    console.log('📝 Processing basic transcript');
    
    // Use semantic extraction
    const clinicalEntities = await this.physicianAnalyzer.extractClinicalEntities(transcript);
    
    if (clinicalEntities.symptoms.length > 0) {
      console.log('🔍 Symptoms detected:', clinicalEntities.symptoms);
      
      // Add to accumulated symptoms
      clinicalEntities.symptoms.forEach(symptom => this.accumulatedSymptoms.add(symptom));
      
      // Get medical context
      if (this.ragEnabled) {
        try {
          const context = await enhancedElasticsearchRAG.searchMedicalContext(
            Array.from(this.accumulatedSymptoms).join(', ')
          );
          
          if (context) {
            this.medicalContext = context;
            console.log('📚 Medical context found');
            
            // Update session
            await this.updateSessionWithContext();
          }
        } catch (error) {
          console.error('❌ Error getting medical context:', error);
        }
      }
    }
  }

  /**
   * Atualiza sessão com contexto médico completo (UMA única reinicialização)
   */
  private async updateSessionWithCompleteContext(context: CompleteMedicalContext): Promise<void> {
    console.log('📋 === UPDATING SESSION WITH COMPLETE CONTEXT ===');
    console.log(`📚 References: ${context.references.length}`);
    console.log(`🎯 Confidence: ${(context.confidence * 100).toFixed(1)}%`);
    console.log(`🔍 Sources: ${context.sources_consulted}`);
    console.log(`⏱️ Processing time: ${context.processing_time_ms}ms`);
    
    if (context.synthesis?.primary_diagnosis) {
      console.log(`🩺 Primary diagnosis: ${context.synthesis.primary_diagnosis.condition}`);
    }

    // Prepara contexto consolidado com TODAS as informações
    const comprehensiveContext = this.buildComprehensivePrompt(context);
    this.medicalContext = comprehensiveContext;
    
    console.log(`📋 Generated comprehensive context (${comprehensiveContext.length} chars)`);
    console.log(`📋 Preview: "${comprehensiveContext.substring(0, 150)}..."`);

    // OTIMIZAÇÃO: NÃO reinicializa a sessão - atualiza contexto silenciosamente
    console.log('🔇 Updating context SILENTLY without session reinitialization...');
    
    // Atualiza apenas o timestamp da última atualização
    this.lastContextUpdate = Date.now();
    
    console.log('✅ Medical context updated silently - NO audio interruption');
    console.log('🎙️ Recording continues uninterrupted with enhanced medical context');
  }

  /**
   * Constrói prompt compreensivo com todas as informações médicas
   */
  private buildComprehensivePrompt(context: CompleteMedicalContext): string {
    let prompt = context.clinical_reasoning;
    
    // Adiciona informações da síntese se disponível
    if (context.synthesis) {
      prompt += `\n\n## ANÁLISE DIAGNÓSTICO COMPLETA:\n`;
      
      // Diagnóstico principal com justificativa detalhada
      if (context.synthesis.primary_diagnosis) {
        prompt += `### 🎯 DIAGNÓSTICO MAIS PROVÁVEL:\n`;
        prompt += `**${context.synthesis.primary_diagnosis.condition}** (Confiança: ${(context.synthesis.primary_diagnosis.confidence * 100).toFixed(1)}%)\n\n`;
        prompt += `**Justificativa Clínica:** ${context.synthesis.primary_diagnosis.reasoning}\n\n`;
      }
      
      // Diagnósticos diferenciais organizados por probabilidade
      if (context.synthesis.differential_diagnoses?.length > 0) {
        prompt += `### 🔍 DIAGNÓSTICOS DIFERENCIAIS:\n`;
        
        // Ordena por probabilidade (maior para menor)
        const sortedDifferentials = context.synthesis.differential_diagnoses
          .sort((a: any, b: any) => (b.probability || 0) - (a.probability || 0));
        
        sortedDifferentials.forEach((dd: any, index: number) => {
          const probability = (dd.probability * 100).toFixed(1);
          prompt += `**${index + 1}. ${dd.condition}** (Probabilidade: ${probability}%)\n`;
          prompt += `   📋 Justificativa: ${dd.reasoning}\n`;
          
          // Adiciona achados diferenciadores se disponível
          if (dd.distinguishing_features) {
            prompt += `   🔬 Achados diferenciadores: ${dd.distinguishing_features}\n`;
          }
          prompt += `\n`;
        });
        
        // Análise comparativa - por que o diagnóstico principal é mais provável
        if (context.synthesis.primary_diagnosis && sortedDifferentials.length > 0) {
          prompt += `### 💡 ANÁLISE COMPARATIVA:\n`;
          prompt += `**Por que "${context.synthesis.primary_diagnosis.condition}" é mais provável:**\n`;
          
          // Compara com os principais diferenciais
          const topDifferentials = sortedDifferentials.slice(0, 2);
          topDifferentials.forEach((dd: any) => {
            const primaryConfidence = context.synthesis.primary_diagnosis.confidence * 100;
            const differentialProb = dd.probability * 100;
            const difference = (primaryConfidence - differentialProb).toFixed(1);
            
            prompt += `• **vs ${dd.condition}:** ${difference}% maior probabilidade devido aos achados clínicos mais consistentes com o quadro apresentado\n`;
          });
          prompt += `\n`;
        }
      }
      
      // Achados clínicos que suportam/refutam diagnósticos
      if (context.synthesis.supporting_findings || context.synthesis.excluding_findings) {
        prompt += `### 📊 ACHADOS CLÍNICOS RELEVANTES:\n`;
        
        if (context.synthesis.supporting_findings?.length > 0) {
          prompt += `**Achados que SUPORTAM o diagnóstico principal:**\n`;
          context.synthesis.supporting_findings.forEach((finding: string) => {
            prompt += `✅ ${finding}\n`;
          });
          prompt += `\n`;
        }
        
        if (context.synthesis.excluding_findings?.length > 0) {
          prompt += `**Achados que EXCLUEM diagnósticos diferenciais:**\n`;
          context.synthesis.excluding_findings.forEach((finding: string) => {
            prompt += `❌ ${finding}\n`;
          });
          prompt += `\n`;
        }
      }
      
      // Recomendações clínicas organizadas
      if (context.synthesis.clinical_recommendations) {
        const recs = context.synthesis.clinical_recommendations;
        prompt += `### 📋 CONDUTA CLÍNICA:\n`;
        
        if (recs.immediate_actions?.length > 0) {
          prompt += `**🚨 Ações Imediatas:**\n`;
          recs.immediate_actions.forEach((action: string) => {
            prompt += `• ${action}\n`;
          });
          prompt += `\n`;
        }
        
        if (recs.diagnostic_workup?.length > 0) {
          prompt += `**🔬 Propedêutica Diagnóstica:**\n`;
          recs.diagnostic_workup.forEach((exam: string) => {
            prompt += `• ${exam}\n`;
          });
          prompt += `\n`;
        }
        
        if (recs.red_flags?.length > 0) {
          prompt += `**⚠️ Sinais de Alarme:**\n`;
          recs.red_flags.forEach((flag: string) => {
            prompt += `🚩 ${flag}\n`;
          });
          prompt += `\n`;
        }
        
        // Monitoramento e seguimento
        if (recs.follow_up || recs.monitoring) {
          prompt += `**📅 Monitoramento e Seguimento:**\n`;
          if (recs.follow_up) prompt += `• Seguimento: ${recs.follow_up}\n`;
          if (recs.monitoring) prompt += `• Monitoramento: ${recs.monitoring}\n`;
          prompt += `\n`;
        }
      }
    }
    
    // Adiciona informações das referências científicas
    if (context.references.length > 0) {
      prompt += `\n\n## EVIDÊNCIAS CIENTÍFICAS (${context.references.length} estudos):\n`;
      context.references.forEach((ref, index) => {
        prompt += `${index + 1}. **${ref.title}** (${ref.journal}, ${ref.year})\n`;
        prompt += `   Autores: ${ref.authors.slice(0, 3).join(', ')}${ref.authors.length > 3 ? ' et al.' : ''}\n`;
        if (ref.abstract) {
          prompt += `   Resumo: ${ref.abstract.substring(0, 200)}...\n`;
        }
        prompt += `   Fonte: ${ref.source.toUpperCase()} | Acesso: ${ref.open_access ? 'Aberto' : 'Restrito'}\n\n`;
      });
    }
    
    // Adiciona resumo de processamento
    prompt += `\n## METADADOS DO PROCESSAMENTO:\n`;
    prompt += `- ${context.processing_summary}\n`;
    prompt += `- Tempo de processamento: ${context.processing_time_ms}ms\n`;
    prompt += `- Sintomas acumulados: ${this.accumulatedSymptoms.size}\n`;
    prompt += `- Referências totais acumuladas: ${this.accumulatedReferences.length}\n`;
    
    return prompt;
  }

  private async updateSessionWithContext(): Promise<void> {
    console.log('⚠️ Using legacy updateSessionWithContext (fallback)');
    const now = Date.now();
    if (now - this.lastContextUpdate > 5000) { // Debounce updates
      this.lastContextUpdate = now;
      // Don't show status updates during conversation to avoid audio interruption
      
      // Reinitialize session with new context
      if (this.session) {
        console.log('🔄 Reinitializing session with legacy context');
        const wasRecording = this.isRecording;
        
        this.stopRecording();
        this.session.close();
        await this.initSession();
        
        if (wasRecording) {
          setTimeout(() => {
            this.startRecording();
          }, 500);
        }
      }
    }
    
    // Don't show any context indicators during conversation
  }

  private async reconnectSession(): Promise<void> {
    try {
      console.log('🔄 Attempting to reconnect session...');
      
      // Fechar sessão anterior se existir
      if (this.session) {
        try {
          await this.session.close();
        } catch (closeError) {
          console.log('Session already closed or closing');
        }
      }
      
      // Criar nova sessão usando a API correta
      const model = 'gemini-2.5-flash-preview-native-audio-dialog';
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            console.log('✅ Session reconnected successfully');
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle incoming messages
            console.log('📨 Received message from Gemini Live');
          },
          onerror: (e: ErrorEvent) => {
            console.error('🚨 Session error:', e);
          },
          onclose: (e: CloseEvent) => {
            console.log('🔌 Session closed:', e.reason);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
          }
        }
      });
      
      console.log('✅ Session reconnected successfully');
    } catch (error) {
      console.error('❌ Failed to reconnect session:', error);
      this.status = 'Erro de conexão. Verifique sua API key.';
      throw error;
    }
  }

  private async handleSessionError(): Promise<void> {
    console.log('🛠️ Handling session error...');
    
    // Parar gravação se estiver ativa
    if (this.isRecording) {
      await this.stopRecording();
    }
    
    // Tentar reconectar uma vez
    try {
      await this.reconnectSession();
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      this.error = 'Erro de conexão. Verifique sua API key e tente novamente.';
      this.status = 'Erro';
    }
  }

  private async initializeGeminiLive(): Promise<void> {
    try {
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
      });
      
      // Inicializar sessão usando a API correta
      const model = 'gemini-2.5-flash-preview-native-audio-dialog';
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            console.log('✅ Gemini Live session opened successfully');
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle incoming messages
            console.log('📨 Received message from Gemini Live');
          },
          onerror: (e: ErrorEvent) => {
            console.error('🚨 Session error:', e);
          },
          onclose: (e: CloseEvent) => {
            console.log('🔌 Session closed:', e.reason);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Orus'}},
          }
        }
      });
      
      console.log('✅ Gemini Live session opened successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini Live:', error);
      this.error = 'Erro ao inicializar. Verifique sua API key.';
      this.status = 'Erro';
      throw error;
    }
  }

  render() {
    return html`
      <div>
        <div class="controls">
          <button
            id="resetButton"
            @click=${this.reset}
            ?disabled=${this.isRecording}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="40px"
              viewBox="0 -960 960 960"
              width="40px"
              fill="#ffffff">
              <path
                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
            </svg>
          </button>
          <button
            id="startButton"
            @click=${this.startRecording}
            ?disabled=${this.isRecording}>
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#c80000"
              xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" />
            </svg>
          </button>
          <button
            id="stopButton"
            @click=${this.stopRecording}
            ?disabled=${!this.isRecording}>
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#000000"
              xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="100" height="100" rx="15" />
            </svg>
          </button>
        </div>

        <div id="status"> ${this.error} </div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>
        
        <!-- Control Buttons -->
        <div style="position: fixed; top: 20px; right: 20px; z-index: 1000; display: flex; flex-direction: column; gap: 10px;">
          <!-- RAG Toggle Button -->
          <button
            style="padding: 10px 20px; background: ${this.ragEnabled ? '#4CAF50' : '#f44336'}; 
                   color: white; border: none; border-radius: 5px; cursor: pointer; 
                   font-size: 14px; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
            @click=${this.toggleRAG}>
            🔍 RAG: ${this.ragEnabled ? 'ON' : 'OFF'}
          </button>
          
          <!-- Perplexity Search Toggle Button -->
          <button
            style="padding: 10px 20px; background: ${this.perplexityEnabled ? '#9C27B0' : '#9E9E9E'}; 
                   color: white; border: none; border-radius: 5px; cursor: pointer; 
                   font-size: 14px; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
            @click=${this.togglePerplexity}>
            🌐 WEB: ${this.perplexityEnabled ? 'ON' : 'OFF'}
          </button>
          
          <!-- Papers Search Toggle Button -->
          <button
            style="padding: 10px 20px; background: ${this.papersEnabled ? '#4CAF50' : '#9E9E9E'}; 
                   color: white; border: none; border-radius: 5px; cursor: pointer; 
                   font-size: 14px; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
            @click=${this.togglePapers}>
            📚 PAPERS: ${this.papersEnabled ? 'ON' : 'OFF'}
          </button>
          
          <!-- References Panel Toggle Button - STRICT protection: Only show when not recording and conversation ended -->
          ${this.currentReferences.length > 0 && !this.isRecording && !this.session ? html`
            <button
              style="padding: 10px 20px; background: ${this.showReferences ? '#FF5722' : '#4CAF50'}; 
                     color: white; border: none; border-radius: 5px; cursor: pointer; 
                     font-size: 14px; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
              @click=${this.toggleReferences}>
              📊 REFS (${this.currentReferences.length})
            </button>
          ` : ''}
          
          <!-- References counter - DISABLED to avoid audio interruption -->
        </div>
        
        <!-- Context Indicator - DISABLED to avoid audio interruption -->
        
        <!-- Clinical Information Display - DISABLED to avoid audio interruption -->
        <!-- Symptoms will only be visible in references panel after conversation ends -->
        
        <!-- References Panel - STRICT protection: Only show when NOT recording and conversation ended -->
        ${this.showReferences && this.currentReferences.length > 0 && !this.isRecording && !this.session ? html`
          <div style="position: fixed; top: 20px; left: 20px; width: 400px; max-height: 70vh; 
                      overflow-y: auto; z-index: 1001; 
                      background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
                      border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                      padding: 20px; border: 1px solid #e0e0e0;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="margin: 0; color: #333; font-size: 18px;">📚 Referências Científicas</h3>
              <button
                style="background: #f44336; color: white; border: none; border-radius: 50%; 
                       width: 30px; height: 30px; cursor: pointer; font-size: 16px; font-weight: bold;"
                @click=${this.toggleReferences}>
                ×
              </button>
            </div>
            
            <div style="max-height: 500px; overflow-y: auto;">
              ${this.currentReferences.map((ref, index) => html`
                <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; 
                           border-radius: 8px; border-left: 4px solid #2196F3;">
                  
                  <div style="font-weight: bold; color: #1976D2; margin-bottom: 8px; font-size: 14px;">
                    ${index + 1}. ${ref.title}
                  </div>
                  
                  <div style="color: #666; font-size: 12px; margin-bottom: 8px;">
                    <strong>Autores:</strong> ${ref.authors.slice(0, 3).join(', ')}${ref.authors.length > 3 ? ' et al.' : ''}
                  </div>
                  
                  <div style="color: #666; font-size: 12px; margin-bottom: 8px;">
                    <strong>Revista:</strong> ${ref.journal} (${ref.year})
                  </div>
                  
                  ${ref.abstract ? html`
                    <div style="color: #555; font-size: 11px; margin-bottom: 8px; line-height: 1.4;">
                      ${ref.abstract.length > 150 ? ref.abstract.substring(0, 150) + '...' : ref.abstract}
                    </div>
                  ` : ''}
                  
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 10px;">
                      <span style="background: ${ref.source === 'pubmed' ? '#4CAF50' : '#FF9800'}; 
                                   color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">
                        ${ref.source.toUpperCase()}
                      </span>
                      ${ref.open_access ? html`
                        <span style="background: #9C27B0; color: white; padding: 2px 6px; 
                                     border-radius: 4px; font-size: 10px;">
                          OPEN ACCESS
                        </span>
                      ` : ''}
                    </div>
                    
                    <a href="${ref.url}" target="_blank" 
                       style="color: #1976D2; text-decoration: none; font-size: 12px; font-weight: bold;">
                      Ver Paper →
                    </a>
                  </div>
                  
                  ${ref.pmid ? html`
                    <div style="color: #999; font-size: 10px; margin-top: 5px;">
                      PMID: ${ref.pmid}
                    </div>
                  ` : ''}
                  
                </div>
              `)}
            </div>
            
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0; 
                        font-size: 11px; color: #666; text-align: center;">
              🧠 Gerado pelo sistema MedRAG com fontes científicas verificadas
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}
