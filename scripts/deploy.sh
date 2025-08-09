#!/bin/bash

# 🚀 Script de Déploiement Netlify
# Usage: ./scripts/deploy.sh

set -e  # Arrêter en cas d'erreur

echo "🎵 Snapcut Beat Editor - Déploiement Netlify"
echo "============================================="

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour logger avec couleurs
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Vérifications pré-déploiement
log_info "Vérifications pré-déploiement..."

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    log_error "package.json non trouvé. Assurez-vous d'être dans le répertoire du projet."
    exit 1
fi

# Vérifier Node.js version
NODE_VERSION=$(node -v)
log_info "Version Node.js: $NODE_VERSION"

# 2. Nettoyer les anciens builds
log_info "Nettoyage des anciens builds..."
npm run clean || true
log_success "Nettoyage terminé"

# 3. Installer les dépendances
log_info "Installation des dépendances..."
npm ci
log_success "Dépendances installées"

# 4. Linter et vérifications
log_info "Vérification du code (linting)..."
npm run lint || log_warning "Warnings trouvés dans le linting (continuer quand même)"

# 5. Build de production
log_info "Build de production en cours..."
npm run build
log_success "Build terminé avec succès"

# 6. Vérifier la taille du build
BUILD_SIZE=$(du -sh dist/ | cut -f1)
log_info "Taille du build: $BUILD_SIZE"

# 7. Tester le build localement
log_info "Test du build local..."
npm run preview &
PREVIEW_PID=$!
sleep 3

# Test de l'endpoint
if curl -s http://localhost:4173 > /dev/null; then
    log_success "Preview fonctionne correctement"
    kill $PREVIEW_PID
else
    log_error "Le preview ne fonctionne pas"
    kill $PREVIEW_PID 2>/dev/null || true
    exit 1
fi

# 8. Résumé
echo ""
echo "📊 Résumé du déploiement:"
echo "========================"
echo "• Build size: $BUILD_SIZE"
echo "• Node version: $NODE_VERSION"
echo "• Files in dist/:"
ls -la dist/ | grep -E "\.(js|css|html)$" | wc -l | xargs echo "  - Assets count:"

echo ""
log_success "🎉 Application prête pour Netlify!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Connecter votre repo Git à Netlify"
echo "2. Configurer les build settings:"
echo "   - Build command: npm run build"
echo "   - Publish directory: dist"
echo "   - Node version: 18"
echo "3. Déployer!"
echo ""
echo "🔗 Liens utiles:"
echo "• Netlify: https://netlify.com"
echo "• Documentation: ./DEPLOY.md"
echo "" 