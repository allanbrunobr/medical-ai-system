# 🚀 Implementação do Langfuse no poc-gemini-live

## 📋 Resumo da Implementação

Esta implementação adiciona observabilidade completa ao `poc-gemini-live` usando o Langfuse, permitindo rastrear:

- **Processamento de áudio em tempo real**
- **Transcrição de fala (Speech-to-Text)**
- **Análise médica em tempo real**
- **Respostas do Gemini**
- **Sessões de conversa completas**
- **Qualidade do áudio**
- **Erros e exceções**

## 🏗️ Arquitetura da Implementação

### 1. **Configuração Base**
- `langfuse-config.ts` - Configuração principal do Langfuse
- `langtrace-service.ts` - Serviço de tracing com métodos específicos
- `langfuse-test.tsx` - Componente de teste do Langfuse

### 2. **Variáveis de Ambiente**
```env
# Langfuse Configuration
VITE_LANGFUSE_PUBLIC_KEY=pk-lf-6a22bbc4-8093-4bc8-8cf7-5070ee80d57e
VITE_LANGFUSE_SECRET_KEY=sk-lf-1a27f540-f81f-4c86-be08-d529d9875727
VITE_LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

### 3. **Dependências**
```json
{
  "langfuse": "^3.38.4"
}
```

## 🔧 Como Usar

### 1. **Instalação**
```bash
cd poc-gemini-live
npm install langfuse@^3.38.4
```

### 2. **Configuração das Variáveis**
Edite o arquivo `.env`:
```env
# Langfuse Configuration
VITE_LANGFUSE_PUBLIC_KEY=sua_public_key_aqui
VITE_LANGFUSE_SECRET_KEY=sua_secret_key_aqui
VITE_LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

### 3. **Integração no Componente Principal**

```typescript
import { LangTraceService } from './langtrace-service';

export class GdmLiveAudio extends LitElement {
  private langTraceService: LangTraceService;

  constructor() {
    super();
    this.langTraceService = new LangTraceService(`session_${Date.now()}`);
  }

  private async processTranscript(transcript: string): Promise<void> {
    try {
      // Rastrear transcrição
      await this.langTraceService.traceSpeechToText(
        transcript,
        5000, // duração do áudio
        0.95  // confidence
      );

      // Rastrear análise médica
      const analysis = await this.performMedicalAnalysis(transcript);
      await this.langTraceService.traceRealTimeMedicalAnalysis(
        transcript,
        analysis,
        Date.now() - startTime
      );

      // Rastrear resposta do Gemini
      await this.langTraceService.traceRealTimeGeminiResponse(
        prompt,
        response,
        'gemini-2.0-flash-lite',
        responseTime
      );

    } catch (error) {
      await this.langTraceService.traceError(error, 'transcript-processing');
    }
  }
}
```

## 📊 Tipos de Traces Disponíveis

### 1. **Audio Processing**
```typescript
await langTraceService.traceAudioProcessing(
  audioData,
  processingTime,
  'excellent'
);
```

### 2. **Speech to Text**
```typescript
await langTraceService.traceSpeechToText(
  transcript,
  audioDuration,
  confidence
);
```

### 3. **Medical Analysis**
```typescript
await langTraceService.traceRealTimeMedicalAnalysis(
  transcript,
  analysisResult,
  responseTime
);
```

### 4. **Gemini Response**
```typescript
await langTraceService.traceRealTimeGeminiResponse(
  prompt,
  response,
  model,
  responseTime
);
```

### 5. **Conversation Session**
```typescript
await langTraceService.traceRealTimeConversationSession({
  total_interactions: 5,
  total_duration_ms: 30000,
  medical_entities_found: 3,
  emergency_detected: false,
  audio_quality_average: 'good'
});
```

### 6. **Audio Quality**
```typescript
await langTraceService.traceAudioQuality(
  'excellent',
  latency,
  errors
);
```

### 7. **Error Tracking**
```typescript
await langTraceService.traceError(error, 'context');
```

## 🧪 Testando a Implementação

### 1. **Componente de Teste**
O arquivo `langfuse-test.tsx` fornece um componente de teste completo:

```typescript
import './langfuse-test';

// No HTML:
<langfuse-test></langfuse-test>
```

### 2. **Verificação no Dashboard**
- Acesse: https://cloud.langfuse.com
- Procure por traces com tags: `test`, `gemini-live`
- Verifique diferentes tipos de traces

## 🔍 Monitoramento

### 1. **Métricas Disponíveis**
- **Latência de resposta**
- **Qualidade do áudio**
- **Confiança da transcrição**
- **Entidades médicas encontradas**
- **Detecção de emergência**
- **Tempo de processamento**

### 2. **Alertas e Scores**
- **Audio Quality Score**: Avaliação da qualidade do áudio
- **Medical Safety Score**: Segurança da análise médica
- **Error Tracking**: Rastreamento de erros

## 🚀 Docker

### 1. **Docker Compose**
O `docker-compose.yml` já inclui as variáveis do Langfuse:

```yaml
environment:
  - VITE_LANGFUSE_PUBLIC_KEY=${VITE_LANGFUSE_PUBLIC_KEY}
  - VITE_LANGFUSE_SECRET_KEY=${VITE_LANGFUSE_SECRET_KEY}
  - VITE_LANGFUSE_BASE_URL=${VITE_LANGFUSE_BASE_URL}
```

### 2. **Execução**
```bash
docker-compose up --build
```

## 📈 Benefícios da Implementação

### 1. **Observabilidade Completa**
- Rastreamento de todo o pipeline de áudio
- Monitoramento de performance em tempo real
- Detecção de problemas de qualidade

### 2. **Análise Médica**
- Rastreamento de entidades médicas
- Monitoramento de detecção de emergência
- Avaliação de confiança das análises

### 3. **Performance**
- Métricas de latência
- Tempo de processamento
- Qualidade do áudio

### 4. **Debugging**
- Rastreamento de erros detalhado
- Contexto completo de cada operação
- Histórico de sessões

## 🔧 Troubleshooting

### 1. **Erro: "Cannot find module 'langfuse'"**
```bash
npm install langfuse@^3.38.4
```

### 2. **Erro: "Chaves do Langfuse não configuradas"**
Verifique as variáveis de ambiente no `.env`:
```env
VITE_LANGFUSE_PUBLIC_KEY=sua_chave_aqui
VITE_LANGFUSE_SECRET_KEY=sua_chave_aqui
```

### 3. **Traces não aparecem no dashboard**
- Verifique se as chaves estão corretas
- Confirme se está usando HTTPS
- Verifique os logs do console

## 📚 Referências

- [Langfuse Documentation](https://langfuse.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Lit Framework](https://lit.dev/)

## 🎯 Próximos Passos

1. **Integração Completa**: Integrar o LangTraceService no componente principal
2. **Métricas Avançadas**: Adicionar métricas específicas para análise médica
3. **Alertas**: Configurar alertas para problemas de qualidade
4. **Dashboard Customizado**: Criar dashboard específico para métricas médicas 