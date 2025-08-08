# 🏥 Medical AI System - Sistema Médico Inteligente

Este repositório contém dois componentes principais de um sistema médico inteligente:

## 📁 Componentes

### 🎤 **poc-stt-tts/** - Sistema de Reconhecimento e Síntese de Voz
- Interface de voz para entrada médica
- Reconhecimento de voz (STT) em português
- Síntese de voz (TTS) para respostas médicas
- Integração com comandos de voz

### 🤖 **poc-gemini-live/** - Sistema de IA Médica Conversacional
- Interface de IA médica baseada no framework AMIE
- Integração com Google Gemini para diagnóstico
- Busca científica em tempo real (PubMed, Perplexity)
- Sistema RAG (Retrieval-Augmented Generation) para dados médicos

## 🚀 Início Rápido

### Pré-requisitos
- Node.js 18+
- Docker e Docker Compose
- Chaves de API:
  - Google Gemini AI
  - Perplexity AI
  - Elasticsearch (opcional)

### Instalação

1. **Clone o repositório:**
```bash
git clone <repository-url>
cd medical-ai-system
```

2. **Configure as variáveis de ambiente:**
```bash
# Para poc-gemini-live
cp poc-gemini-live/env.example poc-gemini-live/.env
# Edite o arquivo .env com suas chaves

# Para poc-stt-tts
cp poc-stt-tts/.env.example poc-stt-tts/.env
# Edite o arquivo .env com suas chaves
```

3. **Execute os sistemas:**

**Sistema STT-TTS:**
```bash
cd poc-stt-tts
docker-compose up -d
# Acesse: http://localhost:3000
```

**Sistema Gemini Live:**
```bash
cd poc-gemini-live
npm install
npm run dev
# Acesse: http://localhost:5173
```

## 🛠️ Tecnologias

- **Frontend:** React, Next.js, TypeScript
- **Backend:** Node.js, Express
- **IA:** Google Gemini, Perplexity AI
- **Voz:** Web Speech API, Google Cloud Speech
- **Banco:** Elasticsearch
- **Deploy:** Docker, Docker Compose
- **Monitoramento:** Langfuse

## 📚 Documentação

- [Documentação do STT-TTS](poc-stt-tts/README.md)
- [Documentação do Gemini Live](poc-gemini-live/README.md)
- [Implementação Langfuse](poc-gemini-live/LANGFUSE_IMPLEMENTATION.md)

## 🔒 Segurança

- Autenticação JWT
- Criptografia de dados sensíveis
- Conformidade com LGPD
- Validação de entrada
- Rate limiting

## 📈 Monitoramento

- Langfuse para monitoramento de IA
- Logs estruturados
- Métricas de performance
- Alertas automáticos

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato através do email: [seu-email@exemplo.com]

---

**⚠️ Aviso:** Este sistema é destinado para uso educacional e de pesquisa. Não deve ser usado para diagnóstico médico real sem aprovação médica adequada.
