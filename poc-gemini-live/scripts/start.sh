#!/bin/bash

echo "🚀 Iniciando POC Gemini Live Doctor..."

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Por favor, instale o Docker primeiro."
    exit 1
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
    exit 1
fi

# Parar containers existentes
echo "🛑 Parando containers existentes..."
docker-compose down

# Construir e iniciar containers
echo "🔨 Construindo containers..."
docker-compose up --build -d

# Aguardar inicialização
echo "⏳ Aguardando inicialização dos serviços..."
sleep 15

# Verificar status
echo "📊 Status dos containers:"
docker-compose ps

echo ""
echo "✅ POC Gemini Live Doctor iniciado com sucesso!"
echo ""
echo "🌐 Acesse:"
echo "   Frontend: http://localhost:5173"
echo "   CORS Proxy: http://localhost:3001"
echo "   Health Check: http://localhost:3001/health"
echo ""
echo "📝 Comandos úteis:"
echo "   Ver logs: docker-compose logs -f"
echo "   Parar:    docker-compose down"
echo "   Reiniciar: docker-compose restart"
echo ""
echo "🎯 Como usar:"
echo "   1. Acesse http://localhost:5173"
echo "   2. Ative o RAG (botão 🔍 RAG: ON)"
echo "   3. Clique no botão de gravação"
echo "   4. Fale sobre o caso clínico em português" 