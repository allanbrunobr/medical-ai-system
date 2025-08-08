# ⚡ Início Rápido - Medical AI System

## 🎯 O que foi preparado

✅ **Repositório limpo** com apenas os componentes essenciais:
- `poc-stt-tts/` - Sistema de voz (STT/TTS)
- `poc-gemini-live/` - Sistema de IA médica
- Documentação completa
- Scripts de automação

✅ **Arquivos incluídos:**
- README.md principal
- .gitignore configurado
- LICENSE (MIT)
- Script de automação (setup-github.sh)
- Instruções detalhadas

✅ **Arquivos removidos:**
- node_modules/
- .env (arquivos de ambiente)
- .next/ (build files)
- *.lock (lock files)
- Arquivos temporários

## 🚀 Criar Repositório no GitHub

### Opção 1: Automático (Recomendado)
```bash
# Se você tem GitHub CLI instalado
./setup-github.sh "medical-ai-system" "Sistema médico inteligente"
```

### Opção 2: Manual
1. Vá para https://github.com/new
2. Nome: `medical-ai-system`
3. Descrição: `Sistema médico inteligente com STT-TTS e IA conversacional`
4. Público
5. **NÃO** inicialize com README
6. Execute:
```bash
git init
git add .
git commit -m "Initial commit: Medical AI System"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/medical-ai-system.git
git push -u origin main
```

## 🔧 Configuração Pós-Criação

### 1. Configurar Ambiente
```bash
# Para poc-gemini-live
cd poc-gemini-live
cp env.example .env
# Edite .env com suas chaves de API

# Para poc-stt-tts  
cd poc-stt-tts
cp .env.example .env
# Edite .env com suas chaves de API
```

### 2. Instalar Dependências
```bash
# poc-gemini-live
cd poc-gemini-live && npm install

# poc-stt-tts
cd poc-stt-tts && npm install
```

### 3. Executar Sistemas
```bash
# Sistema STT-TTS
cd poc-stt-tts
docker-compose up -d
# http://localhost:3000

# Sistema Gemini Live
cd poc-gemini-live
npm run dev
# http://localhost:5173
```

## 📋 Checklist Final

- [ ] Repositório criado no GitHub
- [ ] Código enviado
- [ ] Variáveis de ambiente configuradas
- [ ] Dependências instaladas
- [ ] Sistemas funcionando

## 🎉 Pronto!

Seu sistema médico inteligente está pronto para uso e desenvolvimento!

---

**📚 Documentação completa:** Veja `INSTRUCTIONS.md` para detalhes
**🆘 Suporte:** Abra uma issue no GitHub se precisar de ajuda
