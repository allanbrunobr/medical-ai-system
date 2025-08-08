# 📁 Estrutura do Projeto - poc-gemini-live

## 🎯 Visão Geral

O projeto foi reorganizado seguindo as melhores práticas de desenvolvimento React/TypeScript com uma arquitetura modular e escalável.

## 📂 Estrutura de Diretórios

```
poc-gemini-live/
├── 📁 src/                    # Código fonte principal
│   ├── 📁 components/         # Componentes React
│   ├── 📁 services/           # Serviços e APIs
│   ├── 📁 config/             # Configurações
│   ├── 📁 utils/              # Utilitários
│   ├── 📁 types/              # Definições de tipos TypeScript
│   ├── 📁 tests/              # Testes
│   ├── App.tsx               # Componente principal
│   ├── main.tsx              # Ponto de entrada
│   └── index.css             # Estilos globais
├── 📁 public/                 # Arquivos estáticos
├── 📁 docs/                   # Documentação
├── 📁 scripts/                # Scripts de automação
├── 📁 examples/               # Exemplos de uso
├── 📁 tests/                  # Testes adicionais
├── package.json              # Dependências
├── vite.config.ts            # Configuração Vite
├── tsconfig.json             # Configuração TypeScript
└── docker-compose.yml        # Configuração Docker
```

## 🔧 Componentes Principais

### 📁 `src/components/`
Componentes React reutilizáveis:
- Interface de usuário
- Componentes de formulário
- Componentes de visualização

### 📁 `src/services/`
Serviços e integrações:
- **Medical AI Services**: Sistemas de IA médica
- **Elasticsearch Services**: Integração com busca
- **Langfuse Services**: Monitoramento de IA
- **Visual Services**: Componentes visuais 3D

### 📁 `src/config/`
Configurações do sistema:
- Configuração do Elasticsearch
- Configuração do Langfuse
- Configurações de integração

### 📁 `src/utils/`
Utilitários e helpers:
- Funções auxiliares
- Utilitários de formatação
- Helpers de validação

### 📁 `src/types/`
Definições de tipos TypeScript:
- Interfaces de dados
- Tipos de API
- Tipos de componentes

## 🚀 Como Usar

### Desenvolvimento
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Testes
```bash
npm test
```

## 📚 Documentação

- **API Docs**: `docs/api/`
- **Deployment**: `docs/deployment/`
- **Development**: `docs/development/`

## 🔄 Migração

### Antes vs Depois

**❌ Antes (Desorganizado):**
```
poc-gemini-live/
├── index.tsx (48KB!)
├── *.ts (36 arquivos misturados)
├── *.md (documentação espalhada)
└── *.js (testes misturados)
```

**✅ Depois (Organizado):**
```
poc-gemini-live/
├── src/
│   ├── components/ (UI)
│   ├── services/ (Lógica)
│   ├── config/ (Configurações)
│   └── utils/ (Helpers)
├── docs/ (Documentação)
└── tests/ (Testes)
```

## 🎯 Benefícios da Reorganização

1. **📁 Separação de Responsabilidades**: Cada pasta tem uma função específica
2. **🔍 Facilidade de Navegação**: Estrutura intuitiva e lógica
3. **🧪 Testes Organizados**: Testes separados em pasta própria
4. **📚 Documentação Centralizada**: Toda documentação em um local
5. **⚡ Manutenibilidade**: Código mais fácil de manter e escalar
6. **🔄 Reutilização**: Componentes e serviços bem organizados

## 🔧 Próximos Passos

1. **Refatorar imports**: Atualizar imports para nova estrutura
2. **Adicionar testes**: Expandir cobertura de testes
3. **Documentar APIs**: Criar documentação de APIs
4. **Otimizar build**: Configurar build otimizado
5. **Adicionar CI/CD**: Configurar pipeline de deploy

---

**📝 Nota**: Esta reorganização mantém toda a funcionalidade existente, apenas organizando melhor o código para facilitar desenvolvimento e manutenção.
