import { MedicalQuery, MedicalResponse, MedicalDocument } from './types';

interface EmbeddingResponse {
  embedding: number[];
}

interface VectorSearchResult {
  document: MedicalDocument;
  similarity: number;
}

/**
 * Serviço RAG real usando Gemini para embeddings e geração
 */
export class RealMedicalRAGService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private vectorStore: Map<string, { document: MedicalDocument; embedding: number[] }> = new Map();

  constructor() {
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('GOOGLE_GENERATIVE_AI_API_KEY não encontrada. Usando dados mockados.');
    }
  }

  /**
   * Gera embedding usando Gemini API
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      // Fallback: retorna embedding mockado
      return Array.from({ length: 768 }, () => Math.random());
    }

    try {
      const response = await fetch(`${this.baseUrl}/models/embedding-001:embedContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/embedding-001',
          content: {
            parts: [{ text }]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding.values;
    } catch (error) {
      console.error('Erro ao gerar embedding:', error);
      // Fallback para embedding mockado
      return Array.from({ length: 768 }, () => Math.random());
    }
  }

  /**
   * Calcula similaridade de cosseno entre dois vetores
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Indexa documentos médicos no vector store
   */
  async indexMedicalDocuments(documents: MedicalDocument[]): Promise<void> {
    console.log('🔍 Indexando documentos médicos...');
    
    for (const document of documents) {
      try {
        const embedding = await this.generateEmbedding(document.content);
        this.vectorStore.set(document.id, { document, embedding });
        console.log(`✅ Documento indexado: ${document.metadata.condition}`);
      } catch (error) {
        console.error(`❌ Erro ao indexar documento ${document.id}:`, error);
      }
    }
    
    console.log(`🎉 Total de ${this.vectorStore.size} documentos indexados`);
  }

  /**
   * Busca documentos relevantes usando similaridade vetorial
   */
  async searchSimilarDocuments(query: string, topK: number = 5): Promise<VectorSearchResult[]> {
    if (this.vectorStore.size === 0) {
      console.warn('Vector store vazio. Execute indexMedicalDocuments() primeiro.');
      return [];
    }

    console.log(`🔍 Buscando documentos para: "${query}"`);

    // Gera embedding da query
    const queryEmbedding = await this.generateEmbedding(query);

    // Calcula similaridade com todos os documentos
    const similarities: VectorSearchResult[] = [];
    
    for (const [_, { document, embedding }] of this.vectorStore) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      similarities.push({ document, similarity });
    }

    // Ordena por similaridade e retorna top K
    const results = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    console.log(`📊 Encontrados ${results.length} documentos relevantes`);
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.document.metadata.condition} (similaridade: ${result.similarity.toFixed(3)})`);
    });

    return results;
  }

  /**
   * Gera resposta usando Gemini com contexto dos documentos
   */
  async generateContextualResponse(
    query: string,
    relevantDocuments: MedicalDocument[]
  ): Promise<string> {
    if (!this.apiKey) {
      return 'RAG não configurado. Configure GOOGLE_GENERATIVE_AI_API_KEY para usar o RAG real.';
    }

    // Prepara o contexto dos documentos
    const context = relevantDocuments
      .map((doc, index) => `DOCUMENTO ${index + 1}:\nFonte: ${doc.metadata.source}\nEspecialidade: ${doc.metadata.speciality}\nConteúdo: ${doc.content}`)
      .join('\n\n---\n\n');

    const prompt = `
Você é um assistente médico especializado. Use APENAS as informações dos documentos fornecidos para responder à pergunta do paciente.

DOCUMENTOS DE REFERÊNCIA:
${context}

PERGUNTA DO PACIENTE: ${query}

INSTRUÇÕES:
1. Responda baseado EXCLUSIVAMENTE nos documentos fornecidos
2. Se a informação não estiver nos documentos, diga claramente "não encontrei informações suficientes"
3. Sempre termine com o disclaimer médico obrigatório
4. Use linguagem clara e acessível
5. Se detectar sintomas de emergência, destaque urgência

RESPOSTA:`;

    try {
      const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.candidates[0].content.parts[0].text;

      return generatedText + '\n\n⚠️ DISCLAIMER: Esta informação é apenas educacional e não substitui consulta médica profissional.';
    } catch (error) {
      console.error('Erro ao gerar resposta:', error);
      return 'Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente ou consulte um profissional de saúde.';
    }
  }

  /**
   * Processa uma consulta médica completa com RAG
   */
  async processMedicalQuery(query: MedicalQuery): Promise<MedicalResponse> {
    console.log(`🩺 Processando consulta médica: "${query.text}"`);

    try {
      // 1. Busca documentos similares
      const searchResults = await this.searchSimilarDocuments(query.text, 3);
      const relevantDocuments = searchResults.map(result => result.document);

      // 2. Gera resposta contextual
      const answer = await this.generateContextualResponse(query.text, relevantDocuments);

      // 3. Detecta avisos de emergência
      const warnings = this.detectEmergencyWarnings(query.text);

      // 4. Log de auditoria
      this.logMedicalQuery(query, relevantDocuments.length, searchResults[0]?.similarity || 0);

      return {
        id: `rag-response-${Date.now()}`,
        queryId: query.id,
        answer,
        sources: relevantDocuments,
        confidence: searchResults[0]?.similarity || 0,
        warnings,
        disclaimer: 'Resposta gerada por IA com base em documentos médicos. Sempre consulte um profissional de saúde.'
      };

    } catch (error) {
      console.error('Erro no processamento RAG:', error);
      
      return {
        id: `error-response-${Date.now()}`,
        queryId: query.id,
        answer: 'Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, consulte um profissional de saúde.',
        sources: [],
        confidence: 0,
        warnings: ['❌ Erro no sistema. Busque atendimento médico presencial.'],
        disclaimer: 'Sistema temporariamente indisponível.'
      };
    }
  }

  /**
   * Detecta situações de emergência
   */
  private detectEmergencyWarnings(text: string): string[] {
    const warnings: string[] = [];
    const lowerText = text.toLowerCase();

    const emergencyKeywords = [
      'dor no peito', 'falta de ar', 'dor intensa', 'desmaio', 
      'sangramento', 'convulsão', 'perda de consciência',
      'dificuldade para respirar', 'dor súbita', 'paralisia'
    ];

    if (emergencyKeywords.some(keyword => lowerText.includes(keyword))) {
      warnings.push('🚨 EMERGÊNCIA MÉDICA DETECTADA! Procure atendimento imediato ou ligue 192!');
    }

    if (lowerText.includes('medicamento') || lowerText.includes('remédio')) {
      warnings.push('💊 Nunca tome medicamentos sem prescrição médica.');
    }

    return warnings;
  }

  /**
   * Log de auditoria para consultas médicas
   */
  private logMedicalQuery(query: MedicalQuery, documentsFound: number, topSimilarity: number): void {
    console.log('📝 [AUDIT LOG] Consulta médica processada:', {
      timestamp: new Date().toISOString(),
      queryId: query.id,
      patientId: query.patientId || 'anonymous',
      queryText: query.text,
      documentsFound,
      topSimilarity: topSimilarity.toFixed(3),
      ragVersion: 'real-v1'
    });
  }
}

// Instância singleton do serviço RAG
export const medicalRAGService = new RealMedicalRAGService();

// Dados médicos iniciais para indexação
const initialMedicalDocuments: MedicalDocument[] = [
  {
    id: 'cardio-001',
    content: 'A hipertensão arterial sistêmica (HAS) é definida como pressão arterial sistólica ≥140 mmHg e/ou pressão arterial diastólica ≥90 mmHg, confirmada em pelo menos duas ocasiões. O tratamento inclui modificações do estilo de vida (dieta DASH, exercícios, redução de sal) e farmacoterapia quando indicado. Anti-hipertensivos de primeira linha incluem diuréticos tiazídicos, inibidores da ECA, bloqueadores dos receptores de angiotensina II e bloqueadores dos canais de cálcio.',
    metadata: {
      source: 'Diretrizes Brasileiras de Hipertensão Arterial - 2020',
      speciality: 'Cardiologia',
      condition: 'Hipertensão',
      lastUpdated: new Date('2024-01-15'),
      reliability: 'high'
    }
  },
  {
    id: 'endo-001',
    content: 'Diabetes mellitus tipo 2 é caracterizado por hiperglicemia resultante de defeitos na secreção e/ou ação da insulina. Critérios diagnósticos: glicemia de jejum ≥126 mg/dL, HbA1c ≥6,5%, ou glicemia pós-sobrecarga ≥200 mg/dL. O tratamento envolve mudanças no estilo de vida e medicamentos como metformina como primeira linha. Metas glicêmicas individualizadas são essenciais.',
    metadata: {
      source: 'Diretrizes SBD 2023-2024',
      speciality: 'Endocrinologia',
      condition: 'Diabetes',
      lastUpdated: new Date('2024-02-01'),
      reliability: 'high'
    }
  },
  {
    id: 'neuro-001',
    content: 'Cefaleia tensional é o tipo mais comum de cefaleia primária, caracterizada por dor bilateral, em pressão ou aperto, intensidade leve a moderada, sem agravamento por atividade física. Pode estar associada a fotofobia OU fonofobia (não ambas). Tratamento agudo inclui analgésicos simples (paracetamol, AINEs). Profilaxia quando ≥15 dias/mês com amitriptilina.',
    metadata: {
      source: 'Classificação Internacional de Cefaleias - 3ª edição',
      speciality: 'Neurologia', 
      condition: 'Cefaleia',
      lastUpdated: new Date('2024-01-20'),
      reliability: 'high'
    }
  }
];

// Inicializa automaticamente o RAG service
export async function initializeMedicalRAG(): Promise<void> {
  console.log('🚀 Inicializando Medical RAG Service...');
  await medicalRAGService.indexMedicalDocuments(initialMedicalDocuments);
  console.log('✅ Medical RAG Service inicializado com sucesso!');
}