# Snapcut Beat-Synced Template Editor

Un éditeur de templates vidéo synchronisés aux battements musicaux pour l'application Snapcut.

## 🎯 Fonctionnalités

### ⚡ Random Mode
Génération automatique de cuts synchronisés aux beats avec intelligence musicale :

- **Détection de mesures** : Analyse les patterns rythmiques pour identifier les structures musicales
- **Détection de drops** : Capture automatiquement les moments forts après des silences
- **Placement intelligent** : 
  - Priorité aux débuts de mesure
  - Cuts supplémentaires en milieu de mesure si besoin
  - Évitement des regroupements

### 🎵 Techniques de montage professionnel

#### Cut Timing Optimization
Les cuts sont placés **légèrement avant** les beats détectés pour un rendu plus fluide :

- **Drops** : -50ms avant le beat
- **Débuts de mesure** : -30ms avant le beat  
- **Milieux de mesure** : -30ms avant le beat
- **Autres beats forts** : -20ms avant le beat

> 💡 **Pourquoi ?** Couper exactement sur le beat peut paraître "en retard" à l'œil. L'anticipation de quelques millisecondes donne une sensation de fluidité et de synchronisation parfaite.

## 🎮 Utilisation

1. **Upload** un fichier audio
2. **Définir** les points IN (I) et OUT (O)
3. **Cliquer** "Random" ou presser `R`
4. **Configurer** le nombre de plans
5. **Générer** les cuts automatiques

## ⌨️ Raccourcis

- `Space` : Play/Pause
- `I` / `O` : Points IN/OUT
- `C` : Ajouter un cut manuel
- `R` : Mode Random
- `L` : Toggle Loop
- `←` / `→` : Navigation

## 🎵 Algorithme de détection

### Priorités (0-100 points)
1. **Drops** (100) : Beats forts après silence - toujours inclus
2. **Débuts de mesure** (80-100) : Selon la confiance de détection
3. **Milieux de mesure** (60-80) : Beats forts à mi-mesure
4. **Autres beats** (40-60) : Beats forts génériques

### Détection de mesures
- Analyse des intervalles entre beats forts
- Clustering des patterns rythmiques similaires
- Calcul de confiance basé sur la régularité
- Identification des structures temporelles

### Détection de drops
- Recherche de beats forts après 1.2s+ de silence relatif
- Analyse de l'intensité pour éviter les faux positifs
- Priorisation absolue dans le placement

## 🚀 Export

Génère des fichiers compatibles Snapcut :
- **JSON** : Structure de projet avec timeline et métadonnées
- **Audio Trimé** : Fichier WAV coupé exactement selon les points IN/OUT
- **Nomenclature** : `Category_Template_Music_trimmed_5s-25s_20s.wav`
- **Qualité** : WAV 16-bit non-compressé, qualité studio préservée

## 🛠️ Stack technique

- **React 18** + TypeScript
- **Tailwind CSS** pour le design
- **Web Audio API** pour l'analyse audio
- **Pexels API** pour les vidéos thématiques
- **Vite** pour le développement

## 🔧 Configuration

### Variables d'environnement
Créer un fichier `.env` à la racine :
```bash
# Pexels API (optionnel)
VITE_PEXELS_API_KEY=your_api_key_here
```

**Sans clé API** : L'app fonctionne avec des données de démonstration.  
**Avec clé API** : Accès à 1M+ vidéos Pexels gratuites (200 req/heure).

## 📱 Compatibilité

Optimisé pour l'écosystème **Snapcut** avec :
- Format vertical 9:16
- Timeline de superposition
- Métadonnées complètes
- Structure JSON native

## ☁️ Déploiement sur Vercel

- Le fichier `_headers` (Netlify) n'est pas pris en compte sur Vercel.
- Utilisez `vercel.json` à la racine pour activer SharedArrayBuffer via les en-têtes:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
```

- Les fichiers `public/ffmpeg/ffmpeg-core.{js,wasm,worker.js}` sont auto-hébergés et chargés en priorité pour de meilleures perfs.
- La SPA est réécrite vers `index.html` via `vercel.json`. 