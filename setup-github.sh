#!/bin/bash

# Script para criar e configurar o repositório no GitHub
# Uso: ./setup-github.sh "nome-do-repositorio" "descricao"

set -e

REPO_NAME="${1:-medical-ai-system}"
DESCRIPTION="${2:-Sistema médico inteligente com STT-TTS e IA conversacional}"

echo "🏥 Configurando repositório: $REPO_NAME"
echo "📝 Descrição: $DESCRIPTION"
echo ""

# Verificar se o GitHub CLI está instalado
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI não encontrado. Instale em: https://cli.github.com/"
    echo ""
    echo "Alternativa manual:"
    echo "1. Vá para https://github.com/new"
    echo "2. Crie o repositório: $REPO_NAME"
    echo "3. Execute os comandos abaixo:"
    echo ""
    echo "git init"
    echo "git add ."
    echo "git commit -m 'Initial commit: Medical AI System'"
    echo "git branch -M main"
    echo "git remote add origin https://github.com/SEU_USUARIO/$REPO_NAME.git"
    echo "git push -u origin main"
    exit 1
fi

# Verificar se está logado no GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Não logado no GitHub. Execute: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI configurado"
echo ""

# Criar repositório no GitHub
echo "🔄 Criando repositório no GitHub..."
gh repo create "$REPO_NAME" \
    --description "$DESCRIPTION" \
    --public \
    --source=. \
    --remote=origin \
    --push

echo ""
echo "✅ Repositório criado com sucesso!"
echo "🌐 URL: https://github.com/$(gh api user --jq .login)/$REPO_NAME"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure as variáveis de ambiente (.env) em cada projeto"
echo "2. Instale as dependências: npm install"
echo "3. Execute os sistemas conforme documentado no README.md"
echo ""
echo "🎉 Repositório pronto para uso!"
