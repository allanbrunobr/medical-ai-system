import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context } = body;
    
    if (!context) {
      return NextResponse.json({ 
        success: false, 
        error: 'Contexto é obrigatório.' 
      }, { status: 400 });
    }

    const GEMINI_MODEL = process.env.GEMINI_MODEL_MEDICAL || 'gemini-2.0-flash-lite';
    const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;

    if (!GOOGLE_AI_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chave da API do Google AI não configurada.' 
      }, { status: 500 });
    }

    const prompt = `
Você é um consultor médico IA especializado. Analise o seguinte contexto clínico enriquecido, gerado por um pipeline de análise médica baseada em evidências:

<CONTEXT>
${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}
</CONTEXT>

Sua tarefa como consultor médico:
- Analise o contexto apresentado e forneça insights clínicos relevantes
- Destaque pontos de atenção, possíveis diagnósticos diferenciais
- Sugira investigações complementares se necessário
- Forneça recomendações terapêuticas baseadas em evidências
- Identifique fatores de risco e urgência clínica
- Responda de forma didática e colaborativa para o colega médico

Responda de forma estruturada e clara, focando nos aspectos mais relevantes do caso.
`;

    console.log('🤖 Chamando Gemini com modelo:', GEMINI_MODEL);
    console.log('📝 Prompt length:', prompt.length);

    const geminiStartTime = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_AI_KEY
      },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: prompt }] 
        }],
        generationConfig: { 
          temperature: 0.3, 
          maxOutputTokens: 1500,
          topP: 0.8,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Erro na API do Gemini:', response.status, errorData);
      return NextResponse.json({ 
        success: false, 
        error: `Erro na API do Gemini: ${response.status}` 
      }, { status: 500 });
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!answer) {
      console.error('⚠️ Resposta vazia do Gemini:', data);
      return NextResponse.json({ 
        success: false, 
        error: 'Resposta vazia do modelo.' 
      }, { status: 500 });
    }

    const geminiTime = Date.now() - geminiStartTime;
    console.log('✅ Resposta do Gemini obtida, length:', answer.length);

    return NextResponse.json({ 
      success: true, 
      answer,
      model: GEMINI_MODEL,
      promptLength: prompt.length,
      responseLength: answer.length,
      responseTime: geminiTime
    });

  } catch (error: any) {
    console.error('❌ Erro no endpoint Gemini:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro interno no servidor.' 
    }, { status: 500 });
  }
} 