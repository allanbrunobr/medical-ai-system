#!/bin/bash

echo "🔧 Configurando Langfuse para POC STT-TTS..."
echo ""

# Verificar se as chaves foram fornecidas
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ Uso: ./setup-langfuse.sh <LANGFUSE_PUBLIC_KEY> <LANGFUSE_SECRET_KEY>"
    echo ""
    echo "📝 Exemplo:"
    echo "   ./setup-langfuse.sh pk-lf-abc123... sk-lf-xyz789..."
    echo ""
    echo "🔑 Obtenha suas chaves em: https://cloud.langfuse.com"
    exit 1
fi

PUBLIC_KEY=$1
SECRET_KEY=$2

echo "✅ Configurando chaves do Langfuse..."
echo "   Public Key: ${PUBLIC_KEY:0:20}..."
echo "   Secret Key: ${SECRET_KEY:0:20}..."
echo ""

# Atualizar .env
cd stt-tts
sed -i '' "s/NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=your_langfuse_public_key/NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=$PUBLIC_KEY/" .env
sed -i '' "s/LANGFUSE_SECRET_KEY=your_langfuse_secret_key/LANGFUSE_SECRET_KEY=$SECRET_KEY/" .env

echo "✅ Variáveis de ambiente atualizadas!"
echo ""
echo "🚀 Para testar:"
echo "   cd stt-tts"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "📊 Acesse o dashboard: https://cloud.langfuse.com" 