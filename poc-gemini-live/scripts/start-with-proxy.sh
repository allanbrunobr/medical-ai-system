#!/bin/bash

# Start Gemini Live Doctor with CORS Proxy
# Solves CORS issues when accessing Elasticsearch from browser

echo "🚀 Starting Gemini Live Doctor with CORS Proxy..."
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Check if npm is available  
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔧 Configuration:"
echo "  📡 CORS Proxy: http://localhost:3001"
echo "  🌐 Vite Dev Server: http://localhost:5173"
echo "  📊 Elasticsearch: via proxy (CORS-enabled)"
echo ""

echo "🏁 Starting both servers..."
echo "  Press Ctrl+C to stop both servers"
echo ""

# Start both proxy and dev server concurrently
npm run dev-with-proxy