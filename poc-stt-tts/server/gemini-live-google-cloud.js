/**
 * Servidor Gemini Live com Google Cloud Speech-to-Text e Text-to-Speech
 */

import { WebSocketServer } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carrega variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Add Elasticsearch proxy
import elasticsearchProxy from './elasticsearch-proxy.js';
app.use('/api/elasticsearch', elasticsearchProxy);

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Configuração APIs - Tenta múltiplas fontes
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || 
               process.env.GOOGLE_AI_KEY || 
               'AIzaSyBwnoEr6oNq7yjgvR97ZcqRuvYoC0uW8A4'; // Fallback

console.log('🔍 Verificando API Key:', apiKey ? 'Configurada' : 'Não configurada');
console.log('🔍 Variáveis de ambiente disponíveis:', Object.keys(process.env).filter(key => key.includes('GOOGLE')));

if (!apiKey || apiKey === 'undefined') {
  console.error('❌ ERRO: GOOGLE_GENERATIVE_AI_API_KEY não configurada!');
  console.error('📁 Diretório atual:', __dirname);
  console.error('📄 Arquivo .env esperado:', join(__dirname, '.env'));
  console.error('🔍 Tentando usar fallback...');
}

const genAI = new GoogleGenerativeAI(apiKey);

// Clientes Google Cloud
const speechClient = new SpeechClient();
const ttsClient = new TextToSpeechClient();

// Sessões ativas
const activeSessions = new Map();

class GeminiLiveGoogleCloudSession {
  constructor(websocket, sessionId) {
    this.ws = websocket;
    this.sessionId = sessionId;
    this.geminiModel = null;
    this.isConnected = false;
    this.audioBuffer = [];
    this.isProcessing = false;
    this.conversationHistory = [];
    this.sampleRate = 48000; // Padrão para WEBM OPUS
  }

  async initialize(config = {}) {
    try {
      console.log(`[${this.sessionId}] Iniciando sessão Google Cloud...`);
      
      // Configura modelo Gemini
      this.geminiModel = genAI.getGenerativeModel({
        model: config.model || 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH",
          },
        ],
      });
      
      this.isConnected = true;
      
      // Envia confirmação
      this.sendMessage({
        type: 'connection',
        status: 'connected',
        sessionId: this.sessionId,
        message: 'Assistente médico com Google Cloud Speech pronto'
      });

    } catch (error) {
      console.error(`[${this.sessionId}] Erro ao inicializar:`, error);
      this.sendMessage({
        type: 'error',
        message: 'Erro ao conectar assistente médico',
        error: error.message
      });
    }
  }

  // Processa áudio recebido usando Google Cloud Speech-to-Text
  async processAudio(audioData) {
    if (!this.isConnected || this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      
      // Converte base64 para buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      console.log(`[${this.sessionId}] Processando áudio: ${audioBuffer.length} bytes`);
      
      // Configura requisição para Google Cloud Speech
      const request = {
        audio: {
          content: audioBuffer,
        },
        config: {
          encoding: 'WEBM_OPUS', // Formato que o cliente está enviando
          sampleRateHertz: 48000, // Sample rate do WEBM OPUS
          languageCode: 'pt-BR',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
          model: 'latest_long', // Modelo genérico mais preciso
          // Configurações adicionais para melhor detecção
          useEnhanced: true,
          enableSpeakerDiarization: false,
          alternativeLanguageCodes: ['en-US'], // Fallback
        },
      };
      
      // Transcreve áudio
      const [response] = await speechClient.recognize(request);
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');
      
      if (transcription && transcription.trim()) {
        console.log(`[${this.sessionId}] ✅ Transcrição: ${transcription}`);
        
        // Envia transcrição
        this.sendMessage({
          type: 'transcript',
          text: transcription,
          timestamp: new Date()
        });
        
        // Processa a pergunta médica
        await this.processMedicalQuery(transcription);
      } else {
        console.log(`[${this.sessionId}] ❌ Nenhuma transcrição detectada`);
        
        // Debug: mostra se há resultados mas sem confiança
        if (response.results && response.results.length > 0) {
          console.log(`[${this.sessionId}] Resultados encontrados:`, response.results.length);
          response.results.forEach((result, i) => {
            if (result.alternatives && result.alternatives[0]) {
              console.log(`[${this.sessionId}] Alt ${i}: "${result.alternatives[0].transcript}" (conf: ${result.alternatives[0].confidence})`);
            }
          });
        } else {
          console.log(`[${this.sessionId}] Nenhum resultado retornado pela API`);
        }
      }
      
    } catch (error) {
      console.error(`[${this.sessionId}] Erro ao processar áudio:`, error);
      
      this.sendMessage({
        type: 'error',
        message: 'Erro ao processar áudio. Tente falar mais alto e claro.'
      });
    } finally {
      this.isProcessing = false;
    }
  }

  // Tenta processar áudio com formato alternativo
  async processAudioWithFallback(audioData) {
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    const request = {
      audio: {
        content: audioBuffer,
      },
      config: {
        encoding: 'WEBM_OPUS', // Formato alternativo
        sampleRateHertz: 48000,
        languageCode: 'pt-BR',
        enableAutomaticPunctuation: true,
      },
    };
    
    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join(' ');
    
    if (transcription && transcription.trim()) {
      this.sendMessage({
        type: 'transcript',
        text: transcription,
        timestamp: new Date()
      });
      
      await this.processMedicalQuery(transcription);
    }
  }

  // Processa texto direto
  async processText(text) {
    if (!this.isConnected) return;
    
    try {
      console.log(`[${this.sessionId}] Processando texto:`, text);
      
      this.sendMessage({
        type: 'transcript',
        text: text,
        timestamp: new Date()
      });
      
      await this.processMedicalQuery(text);
      
    } catch (error) {
      console.error(`[${this.sessionId}] Erro ao processar texto:`, error);
      this.sendMessage({
        type: 'error',
        message: 'Erro ao processar pergunta'
      });
    }
  }

  // Processa consulta médica com Elasticsearch RAG
  async processMedicalQuery(text) {
    try {
      // Adiciona à história
      this.conversationHistory.push({
        role: 'user',
        content: text
      });
      
      console.log(`[${this.sessionId}] 🔍 Analisando contexto da conversa...`);
      
      // 1. Extrai sintomas acumulados da conversa
      const accumulatedSymptoms = this.extractSymptomsFromConversation();
      const searchQuery = accumulatedSymptoms.length > 0 ? accumulatedSymptoms.join(' ') : text;
      
      console.log(`[${this.sessionId}] 🔍 Sintomas identificados: ${accumulatedSymptoms.join(', ') || 'nenhum específico'}`);
      console.log(`[${this.sessionId}] 🔍 Buscando no Elasticsearch: "${searchQuery}"`);
      
      // 2. Busca no Elasticsearch com sintomas acumulados
      const elasticsearchResults = await this.searchElasticsearch(searchQuery);
      
      // 3. Analisa se precisa de mais informações (considerando contexto)
      const needsMoreInfo = this.analyzeIfNeedsMoreInfo(text, elasticsearchResults, accumulatedSymptoms);
      
      let response;
      
      if (needsMoreInfo.needs && this.conversationHistory.length < 6) {
        // Faz pergunta de follow-up
        response = await this.generateFollowUpQuestion(text, elasticsearchResults, needsMoreInfo);
      } else {
        // Gera resposta final com base nos dados coletados
        response = await this.generateFinalMedicalResponse(text, elasticsearchResults);
      }
      
      console.log(`[${this.sessionId}] 💬 Resposta gerada: ${response.substring(0, 100)}...`);
      
      // Adiciona resposta à história
      this.conversationHistory.push({
        role: 'assistant',
        content: response
      });
      
      // Detecta emergências
      const hasEmergency = this.detectEmergency(text);
      
      // Envia resposta em texto
      this.sendMessage({
        type: 'response',
        text: response,
        timestamp: new Date(),
        emergency: hasEmergency
      });
      
      // Gera áudio da resposta usando Google Cloud Text-to-Speech
      console.log(`[${this.sessionId}] 🔊 Gerando áudio da resposta...`);
      const audioData = await this.synthesizeSpeech(response);
      if (audioData) {
        console.log(`[${this.sessionId}] ✅ Áudio gerado, enviando para cliente...`);
        this.sendMessage({
          type: 'audio',
          audio: audioData,
          timestamp: new Date()
        });
      } else {
        console.log(`[${this.sessionId}] ❌ Falha ao gerar áudio`);
      }
      
    } catch (error) {
      console.error(`[${this.sessionId}] Erro ao gerar resposta:`, error);
      this.sendMessage({
        type: 'error',
        message: 'Erro ao gerar resposta médica'
      });
    }
  }

  // Extrai sintomas acumulados de toda a conversa
  extractSymptomsFromConversation() {
    const symptoms = [];
    const symptomKeywords = [
      // Português
      'febre', 'dor de cabeça', 'cefaleia', 'tosse', 'dor de garganta', 'náusea', 'vômito',
      'diarreia', 'tontura', 'fadiga', 'cansaço', 'fraqueza', 'dor no corpo', 'mal estar',
      'congestão nasal', 'coriza', 'espirros', 'dor abdominal', 'dor no peito',
      
      // Inglês  
      'fever', 'headache', 'cough', 'sore throat', 'nausea', 'vomiting',
      'diarrhea', 'dizziness', 'fatigue', 'weakness', 'body aches', 'runny nose',
      'sneezing', 'abdominal pain', 'chest pain', 'shortness of breath'
    ];

    // Analisa todas as mensagens do usuário
    this.conversationHistory
      .filter(msg => msg.role === 'user')
      .forEach(msg => {
        const lowerContent = msg.content.toLowerCase();
        
        symptomKeywords.forEach(keyword => {
          if (lowerContent.includes(keyword) && !symptoms.includes(keyword)) {
            symptoms.push(keyword);
          }
        });
      });

    console.log(`[${this.sessionId}] 📋 Sintomas extraídos: ${symptoms.join(', ')}`);
    return symptoms;
  }

  // Busca informações no Elasticsearch
  async searchElasticsearch(query) {
    try {
      console.log(`[${this.sessionId}] 📡 Consultando Elasticsearch Cloud...`);
      
      const elasticsearchUrl = process.env.ELASTICSEARCH_URL;
      const apiKey = process.env.ELASTICSEARCH_API_KEY;
      const indexName = 'search-medical';
      
      if (!elasticsearchUrl || !apiKey) {
        console.log(`[${this.sessionId}] ⚠️ Elasticsearch não configurado, usando dados mock`);
        return this.getMockDiseaseData(query);
      }
      
      const searchBody = {
        size: 5,
        query: {
          bool: {
            should: [
              // Busca em doenças
              {
                match: {
                  Disease: {
                    query,
                    fuzziness: 'AUTO',
                    boost: 3.0
                  }
                }
              },
              // Busca em sintomas
              ...Array.from({ length: 12 }, (_, i) => ({
                match: {
                  [`Symptom_${i + 1}`]: {
                    query,
                    fuzziness: 'AUTO',
                    boost: 1.0
                  }
                }
              }))
            ],
            minimum_should_match: 1
          }
        }
      };

      const response = await fetch(`${elasticsearchUrl}/${indexName}/_search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${apiKey}`
        },
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${this.sessionId}] Elasticsearch error ${response.status}:`, errorText);
        throw new Error(`Elasticsearch error: ${response.status}`);
      }

      const data = await response.json();
      const hits = data.hits.hits;

      // Processa resultados
      const diseases = hits.map(hit => {
        const source = hit._source;
        const symptoms = [];
        
        for (let i = 1; i <= 12; i++) {
          const symptom = source[`Symptom_${i}`];
          if (symptom && symptom.trim() !== '') {
            symptoms.push(symptom.trim());
          }
        }
        
        return {
          disease: source.Disease,
          symptoms: symptoms,
          score: hit._score,
          allSymptoms: symptoms.join(', ')
        };
      });

      console.log(`[${this.sessionId}] 📊 Elasticsearch retornou ${hits.length} resultados`);
      console.log(`[${this.sessionId}] 🔍 Processadas ${diseases.length} doenças relacionadas`);
      
      // Log das primeiras doenças encontradas
      diseases.slice(0, 2).forEach((disease, i) => {
        console.log(`[${this.sessionId}]   ${i + 1}. ${disease.disease} (score: ${disease.score.toFixed(2)})`);
        console.log(`[${this.sessionId}]      Sintomas: ${disease.allSymptoms.substring(0, 100)}...`);
      });
      
      return diseases;

    } catch (error) {
      console.error(`[${this.sessionId}] ❌ Erro no Elasticsearch:`, error);
      // Fallback com dados mock para desenvolvimento
      return this.getMockDiseaseData(query);
    }
  }

  // Dados mock para desenvolvimento
  getMockDiseaseData(query) {
    const mockData = {
      'febre': [
        {
          disease: 'Gripe',
          symptoms: ['Febre', 'Dor de cabeça', 'Dor no corpo', 'Tosse', 'Congestão nasal'],
          score: 0.95,
          allSymptoms: 'Febre, Dor de cabeça, Dor no corpo, Tosse, Congestão nasal'
        },
        {
          disease: 'COVID-19',
          symptoms: ['Febre', 'Tosse seca', 'Fadiga', 'Perda de olfato', 'Dor de garganta'],
          score: 0.90,
          allSymptoms: 'Febre, Tosse seca, Fadiga, Perda de olfato, Dor de garganta'
        }
      ],
      'dor de cabeça': [
        {
          disease: 'Enxaqueca',
          symptoms: ['Dor de cabeça pulsátil', 'Náusea', 'Sensibilidade à luz', 'Vômito'],
          score: 0.92,
          allSymptoms: 'Dor de cabeça pulsátil, Náusea, Sensibilidade à luz, Vômito'
        }
      ]
    };

    const lowerQuery = query.toLowerCase();
    for (const [key, value] of Object.entries(mockData)) {
      if (lowerQuery.includes(key)) {
        return value;
      }
    }
    
    return [];
  }

  // Analisa se precisa de mais informações para diagnóstico
  analyzeIfNeedsMoreInfo(userInput, diseases, accumulatedSymptoms = []) {
    // Se é uma resposta de confirmação e já temos sintomas, não busca mais
    const isConfirmation = /^(yes|no|sim|não|yeah|nope|i do|eu tenho|tenho|não tenho)$/i.test(userInput.trim());
    
    if (isConfirmation && accumulatedSymptoms.length > 0) {
      console.log(`[${this.sessionId}] 🎯 Resposta de confirmação detectada com sintomas: ${accumulatedSymptoms.join(', ')}`);
      return { 
        needs: false, 
        reason: 'confirmation_with_context',
        message: 'Suficientes informações coletadas para diagnóstico.' 
      };
    }
    
    if (diseases.length === 0) {
      return { 
        needs: false, 
        reason: 'no_results',
        message: 'Não encontrei informações sobre esses sintomas.' 
      };
    }

    // Se há muitas doenças possíveis (mais de 3)
    if (diseases.length > 3) {
      return {
        needs: true,
        reason: 'too_many_options',
        diseases: diseases.slice(0, 3),
        message: 'Encontrei várias possibilidades. Preciso de mais detalhes.'
      };
    }

    // Se é a primeira pergunta e muito vaga
    if (this.conversationHistory.length <= 2 && this.isVagueSymptom(userInput)) {
      return {
        needs: true,
        reason: 'vague_symptoms',
        diseases: diseases,
        message: 'Preciso de mais informações sobre seus sintomas.'
      };
    }

    // Se os sintomas das doenças encontradas são muito diferentes
    if (this.hasDiverseSymptoms(diseases)) {
      return {
        needs: true,
        reason: 'diverse_symptoms',
        diseases: diseases,
        message: 'Os sintomas podem indicar condições diferentes.'
      };
    }

    return { needs: false, diseases: diseases };
  }

  // Verifica se o sintoma é muito vago
  isVagueSymptom(input) {
    const vagueSymptoms = [
      'dor', 'mal estar', 'não me sinto bem', 'estou ruim', 
      'febre', 'cansaço', 'fraqueza'
    ];
    
    const lowerInput = input.toLowerCase();
    return vagueSymptoms.some(symptom => 
      lowerInput.includes(symptom) && lowerInput.split(' ').length < 4
    );
  }

  // Verifica se as doenças têm sintomas muito diversos
  hasDiverseSymptoms(diseases) {
    if (diseases.length < 2) return false;
    
    // Conta sintomas únicos vs comuns
    const allSymptoms = diseases.flatMap(d => d.symptoms);
    const uniqueSymptoms = [...new Set(allSymptoms)];
    const commonSymptoms = uniqueSymptoms.filter(symptom =>
      diseases.filter(d => d.symptoms.includes(symptom)).length > 1
    );
    
    // Se menos de 30% dos sintomas são comuns, é diverso
    return (commonSymptoms.length / uniqueSymptoms.length) < 0.3;
  }

  // Gera pergunta de follow-up
  async generateFollowUpQuestion(userInput, diseases, needsMoreInfo) {
    const diseaseContext = diseases.slice(0, 3).map(d => 
      `${d.disease}: ${d.allSymptoms}`
    ).join('\n');

    const prompt = `
Você é um médico fazendo uma consulta. O paciente relatou: "${userInput}"

POSSÍVEIS CONDIÇÕES ENCONTRADAS:
${diseaseContext}

SITUAÇÃO: ${needsMoreInfo.reason}
- too_many_options: Muitas possibilidades
- vague_symptoms: Sintomas muito vagos
- diverse_symptoms: Sintomas indicam condições diferentes

INSTRUÇÕES:
1. Faça UMA pergunta específica e clara
2. Foque no sintoma mais importante para diferenciar as condições
3. Use linguagem simples e empática
4. Pergunte sobre duração, intensidade, ou sintomas relacionados
5. Seja conciso (máximo 2 frases)

EXEMPLOS DE BOAS PERGUNTAS:
- "Há quantos dias você está com febre?"
- "A dor de cabeça é pulsátil ou constante?"
- "Você tem outros sintomas como náusea ou vômito?"

PERGUNTA DE FOLLOW-UP:`;

    try {
      const result = await this.geminiModel.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error(`[${this.sessionId}] Erro ao gerar follow-up:`, error);
      return "Pode me contar mais detalhes sobre seus sintomas? Há quanto tempo começaram?";
    }
  }

  // Gera resposta médica final
  async generateFinalMedicalResponse(userInput, diseases) {
    if (diseases.length === 0) {
      return "Não encontrei informações específicas sobre os sintomas que você mencionou. Recomendo consultar um médico para uma avaliação adequada.";
    }

    const conversationContext = this.conversationHistory
      .slice(-4) // Últimas 4 mensagens para não sobrecarregar
      .map(h => `${h.role}: ${h.content}`)
      .join('\n');

    const diseaseContext = diseases.slice(0, 3).map((d, i) => 
      `CONDIÇÃO ${i + 1}: ${d.disease}
Sintomas típicos: ${d.allSymptoms}
Relevância: ${(d.score * 100).toFixed(1)}%`
    ).join('\n\n');

    const prompt = `
Você é um assistente médico virtual. Com base na conversa e nas informações encontradas, forneça uma resposta educacional.

HISTÓRICO DA CONVERSA:
${conversationContext}

INFORMAÇÕES MÉDICAS ENCONTRADAS:
${diseaseContext}

INSTRUÇÕES:
1. Use APENAS as informações fornecidas
2. Explique as possíveis condições de forma clara
3. Mencione quando procurar atendimento médico
4. Use linguagem acessível
5. Inclua disclaimer médico
6. Seja conciso mas informativo
7. Se detectar urgência, alerte imediatamente

RESPOSTA MÉDICA:`;

    try {
      const result = await this.geminiModel.generateContent(prompt);
      let response = result.response.text().trim();
      
      // Adiciona disclaimer se não tiver
      if (!response.toLowerCase().includes('médico') && !response.toLowerCase().includes('profissional')) {
        response += '\n\nLembre-se: Esta é apenas uma orientação educacional. Sempre consulte um profissional de saúde para diagnóstico e tratamento adequados.';
      }
      
      return response;
    } catch (error) {
      console.error(`[${this.sessionId}] Erro ao gerar resposta final:`, error);
      return "Encontrei informações sobre suas condições, mas recomendo consultar um médico para uma avaliação completa e tratamento adequado.";
    }
  }

  // Sintetiza fala usando Google Cloud Text-to-Speech
  async synthesizeSpeech(text) {
    try {
      console.log(`[${this.sessionId}] Sintetizando fala: ${text.substring(0, 50)}...`);
      
      const request = {
        input: { text: text },
        voice: {
          languageCode: 'pt-BR',
          name: 'pt-BR-Wavenet-A', // Voz feminina natural
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.9, // Ligeiramente mais devagar para clareza
          pitch: 0.0,
          volumeGainDb: 0.0,
        },
      };
      
      const [response] = await ttsClient.synthesizeSpeech(request);
      
      // Converte para base64
      const audioBase64 = response.audioContent.toString('base64');
      console.log(`[${this.sessionId}] Áudio sintetizado com sucesso`);
      
      return audioBase64;
      
    } catch (error) {
      console.error(`[${this.sessionId}] Erro na síntese:`, error);
      return null;
    }
  }

  // Detecta emergências médicas
  detectEmergency(text) {
    const emergencyKeywords = [
      'dor no peito', 'falta de ar', 'desmaio', 'convulsão',
      'sangramento intenso', 'perda de consciência', 'derrame',
      'infarto', 'avc', 'overdose', 'suicídio', 'envenenamento',
      'chest pain', 'difficulty breathing', 'stroke', 'heart attack'
    ];
    
    const lowerText = text.toLowerCase();
    return emergencyKeywords.some(keyword => lowerText.includes(keyword));
  }

  // Envia mensagem para o cliente
  sendMessage(data) {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // Fecha a sessão
  close() {
    this.isConnected = false;
    this.audioBuffer = [];
    this.conversationHistory = [];
    console.log(`[${this.sessionId}] Sessão Google Cloud encerrada`);
  }
}

// Gerencia conexões WebSocket
wss.on('connection', (ws) => {
  const sessionId = `session-${Date.now()}`;
  console.log(`Nova conexão Google Cloud: ${sessionId}`);
  
  let session = null;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'init':
          session = new GeminiLiveGoogleCloudSession(ws, sessionId);
          activeSessions.set(sessionId, session);
          await session.initialize(data.config || {});
          break;
          
        case 'audio':
          if (session && data.audio) {
            await session.processAudio(data.audio);
          }
          break;
          
        case 'text':
          if (session && data.text) {
            await session.processText(data.text);
          }
          break;
          
        case 'close':
          if (session) {
            session.close();
            activeSessions.delete(sessionId);
          }
          break;
          
        default:
          console.log(`[${sessionId}] Tipo de mensagem desconhecido:`, data.type);
      }
      
    } catch (error) {
      console.error(`[${sessionId}] Erro ao processar mensagem:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Erro ao processar mensagem'
      }));
    }
  });
  
  ws.on('close', () => {
    if (session) {
      session.close();
      activeSessions.delete(sessionId);
    }
    console.log(`Conexão fechada: ${sessionId}`);
  });
  
  ws.on('error', (error) => {
    console.error(`Erro WebSocket ${sessionId}:`, error);
  });
});

// Rota de saúde
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Gemini Live Google Cloud Server',
    activeSessions: activeSessions.size,
    timestamp: new Date()
  });
});

// Porta do servidor
const PORT = process.env.GEMINI_LIVE_PORT || 8080;

server.listen(PORT, () => {
  console.log(`🚀 Servidor Gemini Live Google Cloud rodando na porta ${PORT}`);
  console.log(`📡 WebSocket disponível em ws://localhost:${PORT}`);
  console.log(`🏥 Modo médico ativado com Google Cloud Speech APIs`);
  console.log(`🎤 Speech-to-Text: Ativado`);
  console.log(`🔊 Text-to-Speech: Ativado`);
  console.log(`✅ API Key configurada: ${apiKey ? 'Sim' : 'Não'}`);
});

// Trata sinais de término
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, fechando servidor...');
  server.close(() => {
    console.log('Servidor fechado');
  });
});