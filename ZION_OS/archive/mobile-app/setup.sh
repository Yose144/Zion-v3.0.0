#!/bin/bash

# ZION Mobile - Setup Script
# Automatická instalace a konfigurace

echo "🌟 ZION Mobile Setup 🌟"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js není nainstalován"
    echo "Instalujte: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# Check Yarn
if ! command -v yarn &> /dev/null; then
    echo "⚠️  Yarn není nainstalován, instaluji..."
    npm install -g yarn
fi
echo "✅ Yarn: $(yarn --version)"

# Check CocoaPods (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! command -v pod &> /dev/null; then
        echo "⚠️  CocoaPods není nainstalován, instaluji..."
        sudo gem install cocoapods
    fi
    echo "✅ CocoaPods: $(pod --version)"
fi

# Install dependencies
echo ""
echo "📦 Instaluji závislosti..."
yarn install

# iOS setup (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo "🍎 Konfiguruji iOS..."
    cd ios
    pod install
    cd ..
    echo "✅ iOS setup hotový"
fi

echo ""
echo "✨ Setup dokončen!"
echo ""
echo "Spustit aplikaci:"
echo "  yarn ios       # iOS (pouze macOS)"
echo "  yarn android   # Android"
echo ""
