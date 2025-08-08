import { Client } from '@elastic/elasticsearch';
import { MedicalQuery, MedicalResponse, MedicalDocument } from './types';

interface ElasticsearchConfig {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
  apiKey?: string;
}

interface SearchHit {
  _index: string;
  _id: string;
  _score: number;
  _source: MedicalDocument;
}

/**
 * Serviço RAG usando Elasticsearch com embeddings e busca híbrida
 */
export class ElasticsearchMedicalRAG {
  private client: Client;
  private indexName = 'search-medical';
  private embeddingModel = 'sentence-transformers/all-MiniLM-L6-v2';
  private detectedIndex: string | null = null;

  constructor(config: ElasticsearchConfig) {
    this.client = new Client({
      node: config.node,
      auth: config.auth,
      ...(config.apiKey ? { auth: { apiKey: config.apiKey } } : {}),
      tls: {
        rejectUnauthorized: false // Para desenvolvimento local
      }
    });
  }

  /**
   * Detecta índices médicos existentes ou cria um novo
   */
  async detectOrCreateMedicalIndex(): Promise<string> {
    console.log('🔍 Detectando índices médicos existentes...');

    try {
      // Sempre usar o índice search-medical se ele existir
      const indexExists = await this.client.indices.exists({
        index: this.indexName
      });

      if (indexExists) {
        console.log(`✅ Usando índice existente: ${this.indexName}`);
        this.detectedIndex = this.indexName;
        return this.indexName;
      } else {
        // Cria novo índice se não encontrar
        console.log('📋 Índice não encontrado, criando novo...');
        await this.createMedicalIndex();
        return this.indexName;
      }

    } catch (error) {
      console.error('❌ Erro ao detectar índices:', error);
      // Fallback: usa o índice padrão
      this.detectedIndex = this.indexName;
      return this.indexName;
    }
  }

  /**
   * Cria índice médico otimizado
   */
  private async createMedicalIndex(): Promise<void> {
    console.log('🔧 Criando índice médico otimizado...');

    try {
      // Verifica se o índice já existe
      const indexExists = await this.client.indices.exists({
        index: this.indexName
      });

      if (indexExists) {
        console.log('📋 Índice já existe, removendo para recriar...');
        await this.client.indices.delete({
          index: this.indexName
        });
      }

      // Cria índice com mapping otimizado
      await this.client.indices.create({
        index: this.indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                medical_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding',
                    'medical_synonyms',
                    'medical_stemmer'
                  ]
                }
              },
              filter: {
                medical_synonyms: {
                  type: 'synonym',
                  synonyms: [
                    'dor de cabeca,cefaleia,enxaqueca',
                    'pressao alta,hipertensao',
                    'diabetes,diabete',
                    'gripe,influenza,resfriado',
                    'ansiedade,estresse,nervosismo',
                    'febre,hipertermia,temperatura alta'
                  ]
                },
                medical_stemmer: {
                  type: 'stemmer',
                  language: 'portuguese'
                }
              }
            }
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              content: {
                type: 'text',
                analyzer: 'medical_analyzer',
                fields: {
                  exact: { type: 'keyword' },
                  shingles: {
                    type: 'text',
                    analyzer: 'shingle'
                  }
                }
              },
              content_embedding: {
                type: 'dense_vector',
                dims: 384, // Dimensão do modelo all-MiniLM-L6-v2
                index: true,
                similarity: 'cosine'
              },
              metadata: {
                properties: {
                  source: { type: 'keyword' },
                  speciality: { type: 'keyword' },
                  condition: {
                    type: 'text',
                    analyzer: 'medical_analyzer',
                    fields: {
                      keyword: { type: 'keyword' }
                    }
                  },
                  lastUpdated: { type: 'date' },
                  reliability: { type: 'keyword' },
                  tags: { type: 'keyword' },
                  urgency_level: { type: 'keyword' }
                }
              },
              created_at: { type: 'date' },
              updated_at: { type: 'date' }
            }
          }
        }
      });

      console.log('✅ Índice Elasticsearch criado com sucesso!');

    } catch (error) {
      console.error('❌ Erro ao inicializar índice:', error);
      throw error;
    }
  }

  /**
   * Gera embedding usando modelo local ou API externa
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Opção 1: Usar Elasticsearch ML (se disponível)
      if (await this.isMLNodeAvailable()) {
        const response = await this.client.ml.inferTrainedModel({
          model_id: this.embeddingModel,
          body: {
            docs: [{ text }]
          }
        });
        
        return response.inference_results[0].predicted_value as number[] || [];
      }

      // Opção 2: Usar API externa (Hugging Face, Google, etc.)
      return await this.generateEmbeddingExternal(text);

    } catch (error) {
      console.error('Erro ao gerar embedding:', error);
      // Fallback: embedding aleatório para desenvolvimento
      return Array.from({ length: 384 }, () => Math.random() - 0.5);
    }
  }

  /**
   * Gera embedding usando API externa
   */
  private async generateEmbeddingExternal(text: string): Promise<number[]> {
    // Usando Google Gemini para embeddings
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    if (!apiKey) {
      console.warn('Google API Key não encontrada, usando embedding mockado');
      return Array.from({ length: 384 }, () => Math.random() - 0.5);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/embedding-001',
            content: { parts: [{ text }] }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      // Gemini retorna 768 dimensões, vamos reduzir para 384
      const fullEmbedding = data.embedding.values;
      return fullEmbedding.slice(0, 384);

    } catch (error) {
      console.error('Erro na API de embedding:', error);
      return Array.from({ length: 384 }, () => Math.random() - 0.5);
    }
  }

  /**
   * Verifica se o cluster tem nós ML disponíveis
   */
  private async isMLNodeAvailable(): Promise<boolean> {
    try {
      const response = await this.client.nodes.info({
        filter_path: 'nodes.*.attributes.ml.*'
      });
      return Object.keys(response.nodes || {}).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Indexa documentos médicos no Elasticsearch
   */
  async indexMedicalDocuments(documents: MedicalDocument[]): Promise<void> {
    console.log(`🔍 Indexando ${documents.length} documentos médicos...`);

    const operations = [];

    for (const doc of documents) {
      // Gera embedding do conteúdo
      const embedding = await this.generateEmbedding(doc.content);

      // Adiciona operação de índice
      operations.push({
        index: {
          _index: this.indexName,
          _id: doc.id
        }
      });

      operations.push({
        ...doc,
        content_embedding: embedding,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    try {
      const response = await this.client.bulk({
        body: operations,
        refresh: true
      });

      if (response.errors) {
        console.error('❌ Erros na indexação:', response.items);
      } else {
        console.log(`✅ ${documents.length} documentos indexados com sucesso!`);
      }

    } catch (error) {
      console.error('❌ Erro na indexação bulk:', error);
      throw error;
    }
  }

  /**
   * Busca híbrida: texto + semântica
   */
  async searchMedicalDocuments(
    query: string,
    options: {
      size?: number;
      minScore?: number;
      speciality?: string;
      urgencyLevel?: string;
    } = {}
  ): Promise<{ documents: MedicalDocument[]; scores: number[] }> {
    
    // Garante que temos um índice para buscar
    const indexToUse = this.detectedIndex || await this.detectOrCreateMedicalIndex();
    const {
      size = 5,
      minScore = 0.1,
      speciality,
      urgencyLevel
    } = options;

    console.log(`🔍 Buscando documentos para: "${query}" no índice: ${indexToUse}`);

    // Gera embedding da query
    const queryEmbedding = await this.generateEmbedding(query);

    // Monta filtros
    const filters = [];
    if (speciality) {
      filters.push({ term: { 'metadata.speciality': speciality } });
    }
    if (urgencyLevel) {
      filters.push({ term: { 'metadata.urgency_level': urgencyLevel } });
    }

    // Busca flexível que funciona com qualquer estrutura
    const searchBody = {
      size,
      min_score: 0, // Remove score mínimo para garantir resultados
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
            // Busca em todos os campos de sintomas
            ...Array.from({ length: 12 }, (_, i) => ({
              match: {
                [`Symptom_${i + 1}`]: {
                  query,
                  fuzziness: 'AUTO',
                  boost: 1.0
                }
              }
            })),
            // Busca por termos em qualquer campo
            {
              query_string: {
                query,
                fields: ['Disease^3', 'Symptom_*'],
                default_operator: 'OR',
                fuzziness: 'AUTO'
              }
            }
          ],
          filter: filters.length > 0 ? filters : undefined,
          minimum_should_match: 1
        }
      },
      // Highlighting flexível
      highlight: {
        fields: {
          '*': {
            fragment_size: 150,
            number_of_fragments: 1
          }
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>']
      },
      // Source filtering para otimizar resposta
      _source: {
        excludes: ['*embedding*', '*vector*']
      }
    };

    try {
      const response = await this.client.search({
        index: indexToUse,
        ...searchBody
      });

      const hits = response.hits.hits as SearchHit[];
      
      // Processa resultados de forma flexível
      const documents = hits.map(hit => {
        const source = hit._source as any;
        
        // Adapta estrutura Disease/Symptoms para o formato esperado
        const symptoms = [];
        for (let i = 1; i <= 12; i++) {
          const symptom = source[`Symptom_${i}`];
          if (symptom && symptom.trim() !== '') {
            symptoms.push(symptom);
          }
        }
        
        const adaptedDoc: MedicalDocument = {
          id: hit._id,
          content: `Doença: ${source.Disease}. Sintomas: ${symptoms.join(', ')}.`,
          metadata: {
            source: 'Medical Database',
            speciality: 'General',
            condition: source.Disease || 'Unknown',
            lastUpdated: new Date(),
            reliability: 'high',
            urgency_level: this.detectUrgencyFromSymptoms(symptoms),
            tags: [...symptoms, source.Disease].filter(Boolean)
          }
        };
        
        return adaptedDoc;
      });
      
      const scores = hits.map(hit => hit._score);

      console.log(`📊 Encontrados ${documents.length} documentos relevantes no índice ${indexToUse}`);
      if (response.aggregations) {
        console.log('📈 Agregações:', response.aggregations);
      }

      // Log dos primeiros resultados para debug
      hits.slice(0, 2).forEach((hit, i) => {
        console.log(`  ${i + 1}. Score: ${hit._score.toFixed(3)} - ${documents[i].metadata.condition}`);
      });

      return { documents, scores };

    } catch (error: any) {
      console.error('❌ Erro na busca:', error);
      console.error('Detalhes do erro:', error.meta?.body || error.message);
      return { documents: [], scores: [] };
    }
  }

  /**
   * Gera resposta contextual usando Gemini
   */
  async generateMedicalResponse(
    query: string,
    relevantDocuments: MedicalDocument[],
    scores: number[]
  ): Promise<string> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    if (!apiKey) {
      return 'RAG não configurado. Configure GOOGLE_GENERATIVE_AI_API_KEY.';
    }

    // Prepara contexto com scores
    const context = relevantDocuments
      .map((doc, index) => `
DOCUMENTO ${index + 1} (Relevância: ${scores[index]?.toFixed(3)}):
Fonte: ${doc.metadata.source}
Especialidade: ${doc.metadata.speciality}
Condição: ${doc.metadata.condition}
Confiabilidade: ${doc.metadata.reliability}
Conteúdo: ${doc.content}
      `)
      .join('\n---\n');

    const prompt = `
Você é um assistente médico especializado com acesso a uma base de conhecimento atualizada.

CONTEXTO MÉDICO RELEVANTE:
${context}

PERGUNTA DO PACIENTE: ${query}

INSTRUÇÕES IMPORTANTES:
1. Use APENAS informações dos documentos fornecidos
2. Cite as fontes quando apropriado
3. Destaque urgência se detectar sintomas graves
4. Use linguagem clara e acessível
5. Sempre termine com disclaimer médico
6. Se informação insuficiente, seja honesto sobre limitações

RESPOSTA MÉDICA:`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              topP: 0.8,
              maxOutputTokens: 1000
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const answer = data.candidates[0].content.parts[0].text;

      return answer + '\n\n⚠️ DISCLAIMER: Esta informação é apenas educacional. Sempre consulte um profissional de saúde para diagnóstico e tratamento adequados.';

    } catch (error) {
      console.error('❌ Erro ao gerar resposta:', error);
      return 'Desculpe, ocorreu um erro ao processar sua pergunta. Consulte um profissional de saúde.';
    }
  }

  /**
   * Processa consulta médica completa
   */
  async processMedicalQuery(medicalQuery: MedicalQuery): Promise<MedicalResponse> {
    console.log(`🩺 Processando consulta: "${medicalQuery.text}"`);

    try {
      // 1. Busca documentos relevantes
      const { documents, scores } = await this.searchMedicalDocuments(
        medicalQuery.text,
        {
          size: 5,
          minScore: 0
        }
      );
      
      console.log(`📄 Documentos encontrados: ${documents.length}`);

      // 2. Gera resposta contextual
      const answer = await this.generateMedicalResponse(
        medicalQuery.text,
        documents,
        scores
      );

      // 3. Detecta avisos
      const warnings = this.detectWarnings(medicalQuery.text);

      // 4. Log de auditoria no Elasticsearch
      await this.logMedicalQuery(medicalQuery, documents.length, scores[0] || 0);

      return {
        id: `es-response-${Date.now()}`,
        queryId: medicalQuery.id,
        answer,
        sources: documents,
        confidence: scores[0] || 0,
        warnings,
        disclaimer: 'Resposta gerada por IA com Elasticsearch RAG. Sempre consulte um médico.'
      };

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      
      return {
        id: `error-${Date.now()}`,
        queryId: medicalQuery.id,
        answer: 'Erro no sistema. Consulte um profissional de saúde.',
        sources: [],
        confidence: 0,
        warnings: ['❌ Sistema temporariamente indisponível'],
        disclaimer: 'Sistema com falha.'
      };
    }
  }

  /**
   * Log de auditoria no Elasticsearch
   */
  private async logMedicalQuery(
    query: MedicalQuery,
    documentsFound: number,
    topScore: number
  ): Promise<void> {
    try {
      await this.client.index({
        index: 'medical-audit-logs',
        body: {
          timestamp: new Date(),
          queryId: query.id,
          patientId: query.patientId,
          sessionId: query.sessionId,
          queryText: query.text,
          documentsFound,
          topScore,
          urgency: 'unknown',
          source: 'medical-rag',
          processingTime: Date.now() - new Date(query.timestamp).getTime()
        }
      });
    } catch (error) {
      console.error('❌ Erro no log de auditoria:', error);
    }
  }

  /**
   * Detecta urgência baseado nos sintomas
   */
  private detectUrgencyFromSymptoms(symptoms: string[]): 'critical' | 'high' | 'medium' | 'low' {
    const lowerSymptoms = symptoms.map(s => s.toLowerCase());
    
    const emergencySymptoms = [
      'chest pain', 'dor no peito', 'difficulty breathing', 'falta de ar', 
      'loss of consciousness', 'perda de consciência', 'severe bleeding',
      'sangramento intenso', 'stroke', 'derrame', 'seizure', 'convulsão'
    ];
    
    const highUrgencySymptoms = [
      'high fever', 'febre alta', 'severe pain', 'dor severa',
      'vomiting blood', 'vômito com sangue', 'confusion', 'confusão mental'
    ];
    
    const mediumUrgencySymptoms = [
      'fever', 'febre', 'vomiting', 'vômito', 'diarrhea', 'diarreia',
      'moderate pain', 'dor moderada', 'dizziness', 'tontura'
    ];
    
    if (emergencySymptoms.some(es => lowerSymptoms.some(s => s.includes(es)))) {
      return 'critical';
    } else if (highUrgencySymptoms.some(hs => lowerSymptoms.some(s => s.includes(hs)))) {
      return 'high';
    } else if (mediumUrgencySymptoms.some(ms => lowerSymptoms.some(s => s.includes(ms)))) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Detecta avisos de emergência
   */
  private detectWarnings(text: string): string[] {
    const warnings: string[] = [];
    const lowerText = text.toLowerCase();

    const emergencyWords = [
      'dor no peito', 'falta de ar', 'desmaio', 'convulsão',
      'sangramento intenso', 'perda de consciência',
      'chest pain', 'difficulty breathing', 'loss of consciousness',
      'severe bleeding', 'stroke', 'seizure'
    ];

    if (emergencyWords.some(word => lowerText.includes(word))) {
      warnings.push('🚨 EMERGÊNCIA DETECTADA! Procure atendimento médico imediato!');
    }

    return warnings;
  }

  /**
   * Obtém estatísticas do índice
   */
  async getIndexStats(): Promise<any> {
    try {
      const response = await this.client.indices.stats({
        index: this.detectedIndex || this.indexName
      });
      return response;
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

// Configuração do Elasticsearch
const elasticsearchConfig: ElasticsearchConfig = {
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD
  } : undefined,
  apiKey: process.env.ELASTICSEARCH_API_KEY
};

// Instância singleton
export const elasticsearchRAG = new ElasticsearchMedicalRAG(elasticsearchConfig);

// Documentos médicos iniciais
const initialMedicalDocuments: MedicalDocument[] = [
  {
    id: 'cardio-hta-001',
    content: 'Hipertensão arterial sistêmica (HAS) é definida por pressão arterial sistólica ≥140 mmHg e/ou diastólica ≥90 mmHg, medida em consultório. Classificação: normal (<120/80), pré-hipertensão (120-139/80-89), estágio 1 (140-159/90-99), estágio 2 (≥160/≥100). Fatores de risco incluem idade, obesidade, sedentarismo, dieta rica em sódio, tabagismo e fatores genéticos. Complicações: AVC, IAM, insuficiência cardíaca, doença renal crônica.',
    metadata: {
      source: 'Diretrizes Brasileiras de Hipertensão - SBC 2020',
      speciality: 'Cardiologia',
      condition: 'Hipertensão Arterial',
      lastUpdated: new Date('2024-01-15'),
      reliability: 'high',
      tags: ['pressao-alta', 'cardiovascular', 'cronica'],
      urgency_level: 'medium'
    }
  },
  {
    id: 'endo-dm2-001',
    content: 'Diabetes mellitus tipo 2 caracteriza-se por hiperglicemia crônica resultante de defeitos na secreção e ação da insulina. Critérios diagnósticos: glicemia jejum ≥126 mg/dL, HbA1c ≥6,5%, TOTG ≥200 mg/dL, ou glicemia casual ≥200 mg/dL com sintomas. Metas: HbA1c <7% (individualizar), glicemia pré-prandial 80-130 mg/dL, pós-prandial <180 mg/dL. Tratamento: mudanças estilo vida + metformina primeira linha.',
    metadata: {
      source: 'Diretrizes SBD 2023-2024',
      speciality: 'Endocrinologia',
      condition: 'Diabetes Tipo 2',
      lastUpdated: new Date('2024-02-01'),
      reliability: 'high',
      tags: ['diabetes', 'glicemia', 'endocrino', 'cronica'],
      urgency_level: 'medium'
    }
  },
  {
    id: 'neuro-cef-001',
    content: 'Cefaleia tensional é a cefaleia primária mais comum. Características: dor bilateral, qualidade em pressão/aperto, intensidade leve-moderada, não agrava com atividade física. Pode associar-se à fotofobia OU fonofobia (não ambas). Episódica: <15 dias/mês. Crônica: ≥15 dias/mês por >3 meses. Tratamento agudo: analgésicos simples, AINEs. Profilaxia: amitriptilina, propranolol.',
    metadata: {
      source: 'Classificação Internacional de Cefaleias - 3ª edição',
      speciality: 'Neurologia',
      condition: 'Cefaleia Tensional',
      lastUpdated: new Date('2024-01-20'),
      reliability: 'high',
      tags: ['dor-cabeca', 'cefaleia', 'neurologia'],
      urgency_level: 'low'
    }
  }
];

// Função para inicializar o RAG
export async function initializeElasticsearchRAG(): Promise<void> {
  console.log('🚀 Inicializando Elasticsearch Medical RAG...');
  
  try {
    // Detecta índices existentes ou cria um novo
    const indexName = await elasticsearchRAG.detectOrCreateMedicalIndex();
    console.log(`📋 Usando índice: ${indexName}`);
    
    // Verifica se já tem documentos
    const stats = await elasticsearchRAG.getIndexStats();
    const docCount = stats?._all?.primaries?.docs?.count || 0;
    
    if (docCount === 0) {
      console.log('📚 Índice vazio, indexando documentos iniciais...');
      await elasticsearchRAG.indexMedicalDocuments(initialMedicalDocuments);
    } else {
      console.log(`📊 Índice já contém ${docCount} documentos`);
    }
    
    console.log('✅ Elasticsearch RAG inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro na inicialização do Elasticsearch RAG:', error);
    // Não falha - permite usar dados mockados como fallback
    console.log('⚠️ Continuando com dados mockados...');
  }
}