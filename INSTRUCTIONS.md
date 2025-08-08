# 📋 Instruções para Criar o Repositório no GitHub

## 🚀 Método 1: Usando GitHub CLI (Recomendado)

### Pré-requisitos
1. Instale o GitHub CLI: https://cli.github.com/
2. Faça login: `gh auth login`

### Passos
1. **Execute o script automático:**
```bash
./setup-github.sh "nome-do-repositorio" "descricao"
```

Exemplo:
```bash
./setup-github.sh "medical-ai-system" "Sistema médico inteligente com STT-TTS e IA conversacional"
```

## 🚀 Método 2: Manual

### Passo 1: Criar Repositório no GitHub
1. Acesse: https://github.com/new
2. Nome do repositório: `medical-ai-system` (ou seu nome preferido)
3. Descrição: `Sistema médico inteligente com STT-TTS e IA conversacional`
4. Marque como **Public**
5. **NÃO** inicialize com README, .gitignore ou licença
6. Clique em "Create repository"

### Passo 2: Configurar Git Local
```bash
# Inicializar git
git init

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "Initial commit: Medical AI System"

# Renomear branch para main
git branch -M main

# Adicionar remote (substitua SEU_USUARIO pelo seu username)
git remote add origin https://github.com/SEU_USUARIO/medical-ai-system.git

# Fazer push
git push -u origin main
```

## 🔧 Configuração Pós-Criação

### 1. Configurar Variáveis de Ambiente

**Para poc-gemini-live:**
```bash
cd poc-gemini-live
cp env.example .env
# Edite o arquivo .env com suas chaves de API
```

**Para poc-stt-tts:**
```bash
cd poc-stt-tts
cp .env.example .env
# Edite o arquivo .env com suas chaves de API
```

### 2. Instalar Dependências

**Para poc-gemini-live:**
```bash
cd poc-gemini-live
npm install
```

**Para poc-stt-tts:**
```bash
cd poc-stt-tts
npm install
```

### 3. Executar os Sistemas

**Sistema STT-TTS:**
```bash
cd poc-stt-tts
docker-compose up -d
# Acesse: http://localhost:3000
```

**Sistema Gemini Live:**
```bash
cd poc-gemini-live
npm run dev
# Acesse: http://localhost:5173
```

## 📋 Checklist de Verificação

- [ ] Repositório criado no GitHub
- [ ] Código enviado para o repositório
- [ ] README.md configurado
- [ ] .gitignore configurado
- [ ] LICENSE adicionado
- [ ] Variáveis de ambiente configuradas
- [ ] Dependências instaladas
- [ ] Sistemas funcionando localmente

## 🎯 Próximos Passos

1. **Configurar GitHub Pages** (opcional):
   - Vá em Settings > Pages
   - Configure para servir do branch main

2. **Configurar GitHub Actions** (opcional):
   - Crie workflows para CI/CD
   - Configure testes automatizados

3. **Adicionar Badges** (opcional):
   - Status do build
   - Cobertura de testes
   - Versão do projeto

## 🆘 Solução de Problemas

### Erro: "Repository already exists"
- Escolha um nome diferente para o repositório
- Ou delete o repositório existente no GitHub

### Erro: "Authentication failed"
- Execute: `gh auth login`
- Ou configure SSH keys

### Erro: "Permission denied"
- Verifique se você tem permissão para criar repositórios
- Ou use um nome de repositório diferente

## 📞 Suporte

Se encontrar problemas:
1. Verifique se o GitHub CLI está instalado: `gh --version`
2. Verifique se está logado: `gh auth status`
3. Consulte a documentação: https://cli.github.com/
