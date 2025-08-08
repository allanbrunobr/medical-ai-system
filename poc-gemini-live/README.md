# POC Gemini Live Doctor - Sistema Médico Avançado

Sistema de IA médica conversacional baseado no framework AMIE (Articulate Medical Intelligence Explorer) do Google DeepMind, otimizado especificamente para **apoio à decisão médica**.

## 🎯 **Sistema Exclusivo para Médicos**

Este sistema foi desenvolvido para **médicos e profissionais de saúde**, oferecendo:

- **Diagnóstico diferencial bayesiano** com probabilidades
- **Orientações de exame físico** direcionadas
- **Busca científica em tempo real** (PubMed, Perplexity)
- **Análise semiológica** integrada
- **Verificação de interações medicamentosas**
- **Protocolos de emergência** atualizados

## 🚀 **Como Executar**

### **Opção 1: Docker Compose (Recomendado)**

```bash
# Construir e iniciar todos os serviços
docker-compose up --build

# Executar em background
docker-compose up -d --build

# Parar serviços
docker-compose down
```

### **Opção 2: Desenvolvimento Local**

```bash
# Instalar dependências
npm install

# Iniciar com proxy
npm run dev-with-proxy

# Ou usar script automático
./start-with-proxy.sh
```

## 🌐 **Acesso**

- **Frontend**: http://localhost:5173
- **CORS Proxy**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 🏗️ **Arquitetura**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Vite + Lit)                       │
│                        Porta: 5173                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  Gemini Live   │    │ Speech Monitor  │    │   Medical    │ │
│  │   Component    │    │  (Web Speech)   │    │  Analyzer    │ │
│  └────────┬───────┘    └────────┬──────────┘   └──────┬───────┘ │
│           │                     │                       │        │
│           └─────────────────────┴───────────────────────┘        │
│                                 │                                │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
        ┌───────────▼──────────┐    ┌──────────▼──────────┐
        │   CORS Proxy (3001)  │    │  HTTP API (3001)    │
        │   Elasticsearch      │    │ Elasticsearch Proxy │
        └───────────┬──────────┘    └──────────┬──────────┘
                    │                           │
        ┌───────────▼──────────┐    ┌──────────▼──────────┐
        │   Gemini Live API    │    │  Elasticsearch Cloud │
        │  (Audio Processing)  │    │   (Medical Index)    │
        └──────────────────────┘    └─────────────────────┘
```

## 🔬 **Funcionalidades Principais**

### **Análise Médica Avançada**
- **Extração semântica** de entidades médicas
- **Diagnóstico diferencial** com evidências científicas
- **Estratificação de risco** automática
- **Recomendações de investigação** complementar

### **Busca Científica Multi-Fonte**
- **PubMed/medRxiv** para evidências recentes
- **Perplexity AI** para informações atualizadas
- **Elasticsearch** para conhecimento local
- **Citações automáticas** com referências

### **Framework AMIE Implementado**
- **State-aware reasoning** para controle do processo diagnóstico
- **Prevenção de alucinações** com verificações rigorosas
- **Protocolos de segurança** clínica
- **Comunicação empática** mantendo precisão técnica

## 📁 **Estrutura de Arquivos**

```
poc-gemini-live/
├── index.tsx                    # Componente principal
├── index.html                   # HTML de entrada
├── vite.config.ts              # Configuração do Vite
├── package.json                # Dependências
├── .env                        # Variáveis de ambiente
├── docker-compose.yml          # Orquestração Docker
├── Dockerfile                  # Container frontend
├── Dockerfile.proxy            # Container proxy
├── .dockerignore               # Otimização build
├── README.md                   # Este arquivo
│
├── physician-prompt-templates.ts # Templates de prompts médicos
├── medical-literature-search.ts # Busca em PubMed
├── perplexity-search.ts        # Busca Perplexity AI
├── elasticsearch-rag.ts        # Cliente Elasticsearch
├── physician-medical-analyzer.ts # Analisador médico
├── medical-synthesis-engine.ts # Motor de síntese
├── cors-proxy.cjs              # Proxy CORS
└── start-with-proxy.sh         # Script de inicialização
```

## 🎯 **Como Usar**

### **Interface Principal**
1. Acesse `http://localhost:5173`
2. Ative o RAG (botão 🔍 RAG: ON)
3. Clique no botão de gravação
4. Fale sobre o caso clínico em português

### **Exemplos de Uso**

#### **Apresentação de Caso:**
```
"Paciente de 45 anos, masculino, com dor no peito há 2 horas, 
irradiada para braço esquerdo, associada a sudorese e falta de ar. 
PA: 180/110 mmHg, FC: 110 bpm. Histórico de hipertensão e diabetes."
```

#### **Perguntas Diagnósticas:**
```
"Quais são os diagnósticos diferenciais mais prováveis?"
"Que exames complementares são necessários?"
"Qual a estratificação de risco deste paciente?"
```

## 🔧 **Configuração**

### **Variáveis de Ambiente**

O projeto usa as seguintes variáveis (já configuradas no `.env`):

- `GOOGLE_GENERATIVE_AI_API_KEY`: Chave da API do Google Gemini
- `ELASTICSEARCH_URL`: URL do Elasticsearch
- `ELASTICSEARCH_API_KEY`: Chave da API do Elasticsearch
- `PUBMED_API_KEY`: Chave da API do PubMed
- `PERPLEXITY_API_KEY`: Chave da API do Perplexity

## 🛠️ **Comandos Úteis**

```bash
# Ver logs dos containers
docker-compose logs -f

# Reconstruir containers
docker-compose up --build --force-recreate

# Executar apenas um serviço
docker-compose up frontend
docker-compose up proxy

# Desenvolvimento local
npm run dev-with-proxy
```

## 🚨 **Troubleshooting**

### **Problemas Comuns**

1. **CORS Error**: Verifique se o proxy está rodando na porta 3001
2. **API Key Error**: Verifique as variáveis de ambiente no `.env`
3. **Elasticsearch Error**: Verifique a conectividade com o Elasticsearch

### **Logs**

```bash
# Ver logs do frontend
docker-compose logs frontend

# Ver logs do proxy
docker-compose logs proxy
```