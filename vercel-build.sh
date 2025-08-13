#!/bin/bash

# Vercel build script for Loveall project
echo "🚀 Starting Vercel build..."

# Install dependencies
npm install

# Build Next.js frontend only
echo "📦 Building Next.js frontend..."
npm run build

# Copy bot files to api directory for Vercel
echo "🤖 Setting up bot API..."
mkdir -p api
cp bot/webhook-server.js api/bot.js

echo "✅ Build completed successfully!"
