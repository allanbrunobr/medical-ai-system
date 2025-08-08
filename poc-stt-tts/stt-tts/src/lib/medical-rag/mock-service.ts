import { MedicalQuery, MedicalResponse, MedicalDocument } from './types';

// Dados médicos mockados para testes
const mockMedicalDocuments: MedicalDocument[] = [
  {
    id: 'doc-1',
    content: 'A hipertensão arterial é uma condição crônica caracterizada por níveis elevados de pressão sanguínea. Os valores normais são até 120/80 mmHg. Tratamento inclui mudanças no estilo de vida e medicamentos quando necessário.',
    metadata: {
      source: 'Manual de Cardiologia',
      speciality: 'Cardiologia',
      condition: 'Hipertensão',
      lastUpdated: new Date('2024-01-15'),
      reliability: 'high'
    }
  },
  {
    id: 'doc-2',
    content: 'Diabetes tipo 2 é uma doença metabólica caracterizada por resistência à insulina. Sintomas incluem sede excessiva, micção frequente e fadiga. O controle glicêmico é essencial através de dieta, exercícios e medicação.',
    metadata: {
      source: 'Guia de Endocrinologia',
      speciality: 'Endocrinologia',
      condition: 'Diabetes',
      lastUpdated: new Date('2024-02-01'),
      reliability: 'high'
    }
  },
  {
    id: 'doc-3',
    content: 'A gripe é uma infecção viral respiratória. Sintomas incluem febre, tosse, dor no corpo e fadiga. O tratamento é sintomático com repouso, hidratação e analgésicos. A vacinação anual é recomendada.',
    metadata: {
      source: 'Manual de Infectologia',
      speciality: 'Infectologia',
      condition: 'Gripe',
      lastUpdated: new Date('2024-03-10'),
      reliability: 'high'
    }
  },
  {
    id: 'doc-4',
    content: 'Dor de cabeça tensional é o tipo mais comum de cefaleia. Caracteriza-se por dor em pressão ou aperto. Tratamento inclui analgésicos simples, técnicas de relaxamento e identificação de fatores desencadeantes.',
    metadata: {
      source: 'Guia de Neurologia',
      speciality: 'Neurologia',
      condition: 'Cefaleia',
      lastUpdated: new Date('2024-01-20'),
      reliability: 'medium'
    }
  },
  {
    id: 'doc-5',
    content: 'A ansiedade é um transtorno mental comum. Sintomas incluem preocupação excessiva, inquietação e sintomas físicos. O tratamento envolve psicoterapia, técnicas de relaxamento e, quando necessário, medicação.',
    metadata: {
      source: 'Manual de Psiquiatria',
      speciality: 'Psiquiatria',
      condition: 'Ansiedade',
      lastUpdated: new Date('2024-02-15'),
      reliability: 'high'
    }
  }
];

// Respostas pré-definidas para perguntas comuns
const commonResponses: Record<string, string> = {
  'pressao alta': 'Baseado em nossos registros médicos, a pressão alta (hipertensão) é uma condição séria que requer acompanhamento. Valores acima de 140/90 mmHg são considerados elevados. É importante manter uma dieta com baixo teor de sal, praticar exercícios regularmente e tomar a medicação conforme prescrito pelo seu médico.',
  
  'diabetes': 'O diabetes é uma condição que afeta o controle do açúcar no sangue. É fundamental manter uma dieta equilibrada, monitorar regularmente a glicemia e seguir o tratamento prescrito. Sintomas de descontrole incluem sede excessiva e micção frequente.',
  
  'dor de cabeca': 'Dores de cabeça podem ter várias causas. As mais comuns são tensionais, relacionadas ao estresse. Se a dor é intensa, frequente ou acompanhada de outros sintomas como visão turva ou náuseas, é importante buscar avaliação médica.',
  
  'gripe': 'Sintomas gripais incluem febre, tosse, dor no corpo e fadiga. O tratamento geralmente é sintomático com repouso e hidratação. Se os sintomas persistirem por mais de uma semana ou piorarem, procure atendimento médico.',
  
  'ansiedade': 'A ansiedade pode causar sintomas físicos e emocionais. Técnicas de respiração, exercícios regulares e uma rotina de sono adequada podem ajudar. Em casos mais severos, o acompanhamento psicológico é recomendado.'
};

// Simula busca vetorial no RAG
export async function searchMedicalDocuments(
  query: string,
  topK: number = 5
): Promise<MedicalDocument[]> {
  // Simula delay de busca
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const queryLower = query.toLowerCase();
  
  // Busca simples por palavras-chave
  const relevantDocs = mockMedicalDocuments.filter(doc => {
    const content = doc.content.toLowerCase();
    const keywords = queryLower.split(' ');
    return keywords.some(keyword => content.includes(keyword));
  });
  
  // Retorna os top K documentos
  return relevantDocs.slice(0, topK);
}

// Simula geração de resposta com RAG
export async function generateMedicalResponse(
  query: MedicalQuery,
  documents: MedicalDocument[]
): Promise<MedicalResponse> {
  // Simula delay de geração
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const queryLower = query.text.toLowerCase();
  
  // Busca resposta pré-definida
  let answer = '';
  for (const [keyword, response] of Object.entries(commonResponses)) {
    if (queryLower.includes(keyword)) {
      answer = response;
      break;
    }
  }
  
  // Se não encontrou resposta específica, gera uma genérica
  if (!answer && documents.length > 0) {
    answer = `Com base nas informações disponíveis sobre "${query.text}", ${documents[0].content.substring(0, 200)}...`;
  } else if (!answer) {
    answer = 'Desculpe, não encontrei informações específicas sobre sua pergunta em nossa base de conhecimento médico. Por favor, consulte um profissional de saúde para obter orientação adequada.';
  }
  
  // Adiciona disclaimer
  const disclaimer = '\n\nLEMBRETE IMPORTANTE: Esta informação é apenas educacional. Para diagnóstico e tratamento adequados, consulte sempre um médico ou profissional de saúde qualificado.';
  
  return {
    id: `response-${Date.now()}`,
    queryId: query.id,
    answer: answer + disclaimer,
    sources: documents,
    confidence: documents.length > 0 ? 0.8 : 0.3,
    warnings: detectWarnings(query.text),
    disclaimer: 'Esta informação é apenas educacional e não substitui consulta médica profissional.'
  };
}

// Detecta situações que requerem avisos
function detectWarnings(text: string): string[] {
  const warnings: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Palavras que indicam emergência
  const emergencyWords = ['dor no peito', 'falta de ar', 'desmaio', 'sangramento'];
  if (emergencyWords.some(word => lowerText.includes(word))) {
    warnings.push('⚠️ ATENÇÃO: Seus sintomas podem indicar uma emergência médica. Procure atendimento imediato!');
  }
  
  // Palavras relacionadas a medicamentos
  if (lowerText.includes('medicamento') || lowerText.includes('remédio')) {
    warnings.push('💊 Nunca inicie ou interrompa medicamentos sem orientação médica.');
  }
  
  // Sintomas persistentes
  if (lowerText.includes('há dias') || lowerText.includes('há semanas')) {
    warnings.push('📅 Sintomas persistentes devem ser avaliados por um médico.');
  }
  
  return warnings;
}

// Mock do processamento completo
export async function processMedicalQuery(query: MedicalQuery): Promise<MedicalResponse> {
  // 1. Busca documentos relevantes
  const documents = await searchMedicalDocuments(query.text);
  
  // 2. Gera resposta baseada nos documentos
  const response = await generateMedicalResponse(query, documents);
  
  // 3. Log para "auditoria" (em produção seria salvo em BD)
  console.log('[AUDIT] Medical Query:', {
    timestamp: new Date(),
    queryId: query.id,
    patientId: query.patientId,
    query: query.text,
    responseConfidence: response.confidence,
    sourcesUsed: documents.length
  });
  
  return response;
}

// Simula conversão texto-para-voz
export async function textToSpeech(text: string): Promise<ArrayBuffer> {
  // Em produção, usaria a API do Gemini Live
  // Por agora, retorna um buffer vazio
  await new Promise(resolve => setTimeout(resolve, 100));
  return new ArrayBuffer(0);
}

// Simula transcrição de voz
export async function speechToText(audio: ArrayBuffer): Promise<string> {
  // Em produção, usaria a API do Gemini Live
  // Por agora, retorna texto mockado
  await new Promise(resolve => setTimeout(resolve, 100));
  return 'Estou com dor de cabeça há 3 dias';
}