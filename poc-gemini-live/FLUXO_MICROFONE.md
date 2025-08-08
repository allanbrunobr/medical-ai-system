# 🎙️ Fluxo Detalhado do Microfone - Sistema Médico

## 📊 Diagrama de Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           🎙️ INÍCIO DO MICROFONE                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 1️⃣ INICIALIZAÇÃO DO SISTEMA                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • Verifica API Key do Google Gemini                                               │
│ • Inicializa AudioContext (16kHz sample rate)                                    │
│ • Configura WebSocket para Gemini Live                                            │
│ • Inicializa SpeechMonitor                                                       │
│ • Carrega todos os sistemas RAG (Elasticsearch, PubMed, Perplexity)             │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 2️⃣ CAPTURA DE ÁUDIO                                                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • getUserMedia() - Captura stream de áudio                                       │
│ • ScriptProcessorNode - Processa áudio em chunks                                 │
│ • Conversão para Float32Array (16kHz, mono)                                      │
│ • Buffer de áudio acumulado                                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 3️⃣ ENVIO PARA GEMINI LIVE                                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • WebSocket.send() - Envia chunks de áudio                                       │
│ • Modality.AUDIO - Especifica tipo de entrada                                   │
│ • Streaming em tempo real                                                        │
│ • Aguarda resposta do Gemini                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 4️⃣ PROCESSAMENTO DO GEMINI                                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • Speech-to-Text em tempo real                                                   │
│ • Análise de contexto médico                                                     │
│ • Geração de resposta médica                                                     │
│ • Text-to-Speech da resposta                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 5️⃣ RECEPÇÃO DA RESPOSTA                                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • WebSocket.onmessage() - Recebe resposta                                        │
│ • Decodificação do áudio de resposta                                             │
│ • Reprodução via AudioContext                                                    │
│ • Atualização da interface                                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 6️⃣ ANÁLISE MÉDICA (SE NECESSÁRIO)                                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • Extração de entidades clínicas                                                 │
│ • Busca em Elasticsearch + PubMed + Perplexity                                  │
│ • Síntese médica com evidências científicas                                     │
│ • Geração de diagnóstico diferencial                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 7️⃣ RESPOSTA FINAL                                                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • Text-to-Speech da análise médica                                               │
│ • Reprodução da resposta final                                                   │
│ • Atualização da interface com referências                                       │
│ • Fim do ciclo                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 🔧 Componentes Técnicos Detalhados

### **1. Inicialização do Sistema**
```typescript
// index.tsx:183
private async initializeGeminiLive(): Promise<void> {
  this.client = new GoogleGenAI(this.apiKey);
  this.session = await this.client.getGenerativeModel({model: 'gemini-1.5-flash-exp'})
    .startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });
}
```

### **2. Captura de Áudio**
```typescript
// index.tsx:331
private scriptProcessorNode = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
this.scriptProcessorNode.onaudioprocess = (event) => {
  const inputData = event.inputBuffer.getChannelData(0);
  // Processa e envia para Gemini
};
```

### **3. Envio para Gemini**
```typescript
// index.tsx:340
await this.session.sendMessageStream({
  contents: [{
    role: 'user',
    parts: [{
      inlineData: {
        mimeType: 'audio/webm;codecs=opus',
        data: audioBlob
      }
    }]
  }]
});
```

### **4. Processamento Médico**
```typescript
// index.tsx:720
private async processPhysicianTranscript(transcript: string): Promise<void> {
  const clinicalEntities = await this.physicianAnalyzer.extractClinicalEntities(transcript);
  // Busca em múltiplas fontes médicas
  const medicalContext = await this.enhancedMedRAGSystem.searchMedicalContext(transcript);
}
```

## ⚠️ Pontos de Falha Identificados

### **1. API Key Expirada**
```
❌ index.tsx:227 🔌 Gemini Live session closed: API key expired
```
**Solução:** Renovar a API key no Google Cloud Console

### **2. WebSocket Fechado**
```
❌ WebSocket is already in CLOSING or CLOSED state
```
**Causa:** Sessão fechada por erro de autenticação
**Solução:** Verificar API key e billing

### **3. Pipeline de Áudio**
```
❌ scriptProcessorNode.onaudioprocess @ index.tsx:331
```
**Causa:** Tentativa de enviar áudio para socket fechado
**Solução:** Implementar verificação de estado do socket

## 🔄 Fluxo Alternativo (test-complete-flow.js)

### **Diferenças Principais:**
1. **Autenticação:** Usa método diferente de autenticação
2. **Streaming:** Implementa streaming de forma mais robusta
3. **Error Handling:** Melhor tratamento de erros de conexão
4. **Reconexão:** Implementa reconexão automática

### **Implementação Recomendada:**
```typescript
// Verificar estado antes de enviar
if (this.session && this.session.isConnected()) {
  await this.session.sendMessageStream(/* ... */);
} else {
  await this.reconnectSession();
}
```

## 📋 Checklist de Verificação

- [ ] API Key válida e ativa
- [ ] Billing habilitado no Google Cloud
- [ ] WebSocket conectado antes de enviar áudio
- [ ] AudioContext inicializado corretamente
- [ ] SpeechMonitor funcionando
- [ ] Sistemas RAG carregados
- [ ] Tratamento de erros implementado

## 🚀 Próximos Passos

1. **Renovar API Key** no Google Cloud Console
2. **Verificar billing** do projeto
3. **Implementar verificação de estado** do WebSocket
4. **Adicionar reconexão automática** em caso de falha
5. **Melhorar error handling** no pipeline de áudio 