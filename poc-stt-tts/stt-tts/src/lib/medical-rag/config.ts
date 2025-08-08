import { RAGConfig } from './types';

// Configuração padrão para RAG médico
export const defaultMedicalRAGConfig: RAGConfig = {
  vectorDB: {
    provider: 'local', // Começa com local, pode mudar para pinecone/weaviate
    namespace: 'medical-knowledge',
  },
  search: {
    topK: 5, // Busca os 5 documentos mais relevantes
    minScore: 0.7, // Score mínimo de relevância
    reranking: true, // Reordena resultados por relevância
  },
  generation: {
    model: 'gemini-2.5-flash', // Modelo mais recente com reasoning
    temperature: 0.3, // Baixa para respostas mais precisas
    maxTokens: 2048,
    systemPrompt: `Você é um assistente médico virtual treinado para fornecer informações baseadas em conhecimento médico verificado.

INSTRUÇÕES IMPORTANTES:
1. Baseie suas respostas APENAS nas informações fornecidas no contexto
2. Se não tiver informação suficiente, diga claramente
3. SEMPRE inclua o disclaimer sobre consultar um profissional
4. Use linguagem clara e acessível
5. Evite jargões médicos complexos sem explicação
6. Seja empático e profissional

FORMATO DA RESPOSTA:
- Comece com uma resposta direta à pergunta
- Explique baseando-se nos documentos fornecidos
- Termine com orientações e o disclaimer

DISCLAIMER OBRIGATÓRIO:
"Esta informação é apenas educacional. Para diagnóstico e tratamento, consulte sempre um médico ou profissional de saúde qualificado."`,
  },
  voice: {
    inputLanguage: 'pt-BR',
    outputVoice: 'Puck', // Voz mais calma e profissional
    speakingRate: 0.95, // Fala um pouco mais devagar para clareza
  },
};

// Prompts específicos por tipo de consulta
export const medicalPrompts = {
  symptoms: `Ao descrever sintomas, seja cuidadoso e não faça diagnósticos. 
    Liste possíveis causas comuns e sempre recomende buscar avaliação médica.`,
  
  medications: `Ao falar sobre medicamentos, mencione apenas informações gerais.
    NUNCA recomende dosagens ou substituições. Sempre oriente consultar o médico.`,
  
  emergency: `Se detectar sinais de emergência, oriente IMEDIATAMENTE a buscar 
    atendimento de urgência ou ligar para emergência (192/193).`,
  
  general: `Forneça informações educacionais gerais sobre saúde, sempre
    enfatizando a importância do acompanhamento médico profissional.`,
};

// Palavras-chave de emergência
export const emergencyKeywords = [
  'dor no peito',
  'falta de ar',
  'desmaio',
  'convulsão',
  'sangramento intenso',
  'avc',
  'derrame',
  'infarto',
  'overdose',
  'suicídio',
  'emergência',
  'urgente',
];

// Configuração de segurança e compliance
export const medicalSafetyConfig = {
  // Log todas as interações para auditoria
  enableAuditLog: true,
  
  // Require autenticação
  requireAuth: true,
  
  // Tempo máximo de sessão (30 minutos)
  maxSessionDuration: 30 * 60 * 1000,
  
  // Filtros de conteúdo
  contentFilters: {
    blockPersonalInfo: true, // Remove CPF, nomes completos, etc.
    blockMedicalRecords: true, // Não processa prontuários
    sanitizeInput: true, // Limpa entrada do usuário
  },
  
  // Avisos obrigatórios
  mandatoryWarnings: {
    start: 'Este é um assistente informativo. Não substitui consulta médica.',
    emergency: 'Em caso de emergência, procure imediatamente um serviço de saúde ou ligue 192/193.',
    end: 'Lembre-se: sempre consulte um profissional de saúde para diagnóstico e tratamento.',
  },
};