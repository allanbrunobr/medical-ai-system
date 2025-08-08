import { NextRequest, NextResponse } from 'next/server';
import { runMedicalPipeline } from '@/lib/medical-pipeline/pipeline';
import { LangTraceService } from '@/lib/langtrace-service';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const sessionId = `api_${Date.now()}`;
  const langTrace = new LangTraceService(sessionId);

  try {
    const body = await request.json();
    const { transcript } = body;
    
    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ success: false, error: 'Transcript é obrigatório.' }, { status: 400 });
    }

    // Rastrear requisição do frontend
    await langTrace.traceFrontendRequest(
      '/api/medical/pipeline',
      { transcript },
      { status: 'processing' },
      Date.now() - startTime
    );

    const result = await runMedicalPipeline(transcript);
    
    // Rastrear resposta de sucesso
    await langTrace.traceFrontendRequest(
      '/api/medical/pipeline',
      { transcript },
      { success: true, result: { entities: result.entities, synthesis_length: result.synthesis.length } },
      Date.now() - startTime
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    // Rastrear erro
    await langTrace.traceError(error, 'api-medical-pipeline');
    
    return NextResponse.json({ success: false, error: error.message || 'Erro interno.' }, { status: 500 });
  }
} 