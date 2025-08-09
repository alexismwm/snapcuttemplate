#!/bin/bash

# 🚀 Script de déploiement production - Snapcut Beat Editor
# Déploie la version corrigée avec mode fallback FFmpeg

echo "🚀 Déploiement Production - Snapcut Beat Editor"
echo "================================================="

# Vérification que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Veuillez exécuter ce script depuis la racine du projet"
    exit 1
fi

echo "📋 Vérification des dépendances..."
if ! command -v npm &> /dev/null; then
    echo "❌ Erreur: npm n'est pas installé"
    exit 1
fi

echo "📦 Installation des dépendances..."
npm install

echo "🏗️  Build de production..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build"
    exit 1
fi

echo "✅ Build réussi!"
echo ""
echo "📁 Fichiers générés dans le dossier 'dist/'"
echo "📊 Statistiques du build:"
du -sh dist/

echo ""
echo "🎯 PRÊT POUR DÉPLOIEMENT!"
echo "=========================="
echo ""
echo "🔧 Fonctionnalités de cette version:"
echo "  ✅ Mode fallback FFmpeg pour la production"
echo "  ✅ Export gracieux même si vidéos échouent"
echo "  ✅ JSON + Audio + Thumbnails toujours disponibles"
echo "  ✅ Messages d'erreur clairs pour l'utilisateur"
echo ""
echo "📤 Étapes de déploiement sur Netlify:"
echo "  1. Connectez-vous à votre dashboard Netlify"
echo "  2. Glissez-déposez le dossier 'dist/' sur Netlify"
echo "  3. Ou utilisez: netlify deploy --prod --dir=dist"
echo ""
echo "⚠️  Note: Les headers CORS sont configurés dans netlify.toml"
echo "🎉 L'application gère maintenant les limitations de production!"

# Ouvrir le dossier dist dans Finder (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo "📂 Ouverture du dossier dist..."
    open dist/
fi

echo "�� Déploiement prêt!" 