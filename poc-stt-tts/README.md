# POC STT-TTS - Speech-to-Text e Text-to-Speech

Este projeto demonstra um sistema completo de Speech-to-Text e Text-to-Speech usando Next.js, Gemini AI e Google Cloud Speech APIs.

## Estrutura do Projeto

```
poc-stt-tts/
├── stt-tts/          # Frontend Next.js
├── server/           # Backend Gemini Live Server
├── docker-compose.yml
└── README.md
```

## Serviços

### Frontend (stt-tts)
- **Porta**: 3000
- **Tecnologia**: Next.js + React
- **Funcionalidades**: Interface web para STT/TTS

### Backend (server)
- **Porta**: 8080
- **Tecnologia**: Node.js + WebSocket
- **Funcionalidades**: Gemini AI + Google Cloud Speech APIs

## Como Executar

### Opção 1: Docker Compose (Recomendado)

```bash
# Usar script de inicialização
./start.sh

# Ou manualmente:
# Construir e iniciar todos os serviços
docker-compose up --build

# Executar em background
docker-compose up -d --build

# Parar serviços
docker-compose down
```

### Opção 1.1: Docker Compose para Desenvolvimento

```bash
# Usar configuração de desenvolvimento (com hot-reload)
docker-compose -f docker-compose.dev.yml up --build

# Executar em background
docker-compose -f docker-compose.dev.yml up -d --build
```

### Opção 2: Desenvolvimento Local

```bash
# Terminal 1 - Frontend
cd stt-tts
npm install
npm run dev

# Terminal 2 - Backend
cd server
npm install
node gemini-live-google-cloud.js
```

## Acesso

- **Frontend**: http://localhost:3000
- **Backend WebSocket**: ws://localhost:8080

## Configuração

### Variáveis de Ambiente

O projeto usa as seguintes variáveis de ambiente (já configuradas no `.env`):

- `GOOGLE_GENERATIVE_AI_API_KEY`: Chave da API do Google Gemini
- `GOOGLE_APPLICATION_CREDENTIALS`: Credenciais do Google Cloud
- `ELASTICSEARCH_URL`: URL do Elasticsearch
- `ELASTICSEARCH_API_KEY`: Chave da API do Elasticsearch

## Funcionalidades

- 🎤 **Speech-to-Text**: Transcrição de áudio em tempo real
- 🔊 **Text-to-Speech**: Síntese de voz
- 🤖 **IA Médica**: Assistente médico com Gemini AI
- 🔍 **Busca Semântica**: Integração com Elasticsearch
- 📚 **Literatura Médica**: Busca no PubMed

## Desenvolvimento

### Estrutura de Arquivos

```
stt-tts/
├── src/
│   ├── app/           # Páginas Next.js
│   ├── components/    # Componentes React
│   ├── hooks/         # Custom hooks
│   └── lib/           # Utilitários
├── public/            # Arquivos estáticos
└── package.json

server/
├── gemini-live-google-cloud.js  # Servidor principal
├── service-account.json          # Credenciais Google Cloud
├── .env                         # Variáveis de ambiente
└── package.json
```

### Comandos Úteis

```bash
# Ver logs dos containers
docker-compose logs -f

# Reconstruir containers
docker-compose up --build --force-recreate

# Executar apenas um serviço
docker-compose up frontend
docker-compose up backend
```

## Troubleshooting

### Problemas Comuns

1. **Porta já em uso**: Verifique se as portas 3000 e 8080 estão livres
2. **Erro de API Key**: Verifique as variáveis de ambiente
3. **WebSocket não conecta**: Verifique se o backend está rodando

### Logs

```bash
# Ver logs do frontend
docker-compose logs frontend

# Ver logs do backend
docker-compose logs backend
``` 