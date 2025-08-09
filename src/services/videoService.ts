import { VideoTheme, VideoAsset, VideoSearchParams } from '../types/video';
import { pexelsService } from './pexelsService';
import { videoCache } from './videoCache';

/**
 * Service principal pour la gestion des vidéos
 * Combine l'API Pexels et le cache pour une interface unifiée
 */
class VideoService {
  /**
   * Obtient les vidéos pour un thème donné avec mots-clés personnalisés
   * Force le refresh à chaque changement pour éviter les problèmes de cache
   */
  async getVideosByTheme(theme: VideoTheme, forceRefresh = false, customKeywords?: string[]): Promise<VideoAsset[]> {
    try {
      // Si des mots-clés personnalisés, toujours faire une nouvelle recherche
      const hasCustomKeywords = customKeywords && customKeywords.length > 0;
      
      // TOUJOURS nettoyer le cache si custom keywords ou forceRefresh
      if (hasCustomKeywords || forceRefresh) {
        console.log(`🧹 Clearing cache for theme "${theme}" (custom keywords or forced refresh)`);
        videoCache.delete(theme);
      }
      
      // Vérifier le cache d'abord (seulement si pas de custom keywords et pas de force refresh)
      if (!forceRefresh && !hasCustomKeywords) {
        const cachedVideos = videoCache.get(theme);
        if (cachedVideos && cachedVideos.length > 0) {
          console.log(`📂 Using cached videos for theme "${theme}"`);
          return cachedVideos;
        }
      }

      // Charger depuis l'API Pexels
      const keywordInfo = hasCustomKeywords ? ` with keywords: [${customKeywords.join(', ')}]` : '';
      console.log(`🌐 Fetching videos for theme "${theme}"${keywordInfo} from API`);
      
      const searchParams: VideoSearchParams = {
        theme,
        perPage: 20,
        orientation: 'portrait', // Préférer format mobile
        minDuration: 5, // Au moins 5 secondes
        maxDuration: 60 // Maximum 1 minute
      };

      const videos = await pexelsService.searchVideosByTheme(searchParams, customKeywords);
      
      // Mettre en cache les résultats (seulement si pas de custom keywords)
      if (videos.length > 0 && !hasCustomKeywords) {
        videoCache.set(theme, videos);
      }

      return videos;

    } catch (error) {
      console.error(`Failed to load videos for theme "${theme}":`, error);
      
      // En cas d'erreur, essayer le cache comme fallback
      const cachedVideos = videoCache.get(theme);
      if (cachedVideos) {
        console.log(`📂 Using cached videos as fallback for theme "${theme}"`);
        return cachedVideos;
      }
      
      // Si pas de cache, retourner array vide
      return [];
    }
  }

  /**
   * Obtient les vidéos populaires pour un thème
   */
  async getPopularVideosByTheme(theme: VideoTheme): Promise<VideoAsset[]> {
    try {
      const cacheKey = `${theme}_popular`;
      
      // Vérifier le cache spécifique aux vidéos populaires
      const cached = videoCache.get(theme);
      if (cached && cached.length > 0) {
        // Retourner les 10 premières comme "populaires"
        return cached.slice(0, 10);
      }

      // Charger les vidéos populaires depuis l'API
      const videos = await pexelsService.getPopularVideos(theme, 15);
      
      if (videos.length > 0) {
        videoCache.set(theme, videos);
      }

      return videos;

    } catch (error) {
      console.error(`Failed to load popular videos for theme "${theme}":`, error);
      return [];
    }
  }

  /**
   * Recherche de vidéos avec des paramètres personnalisés
   */
  async searchVideos(params: VideoSearchParams): Promise<VideoAsset[]> {
    try {
      return await pexelsService.searchVideosByTheme(params);
    } catch (error) {
      console.error('Video search failed:', error);
      return [];
    }
  }

  /**
   * Précharge les vidéos pour les thèmes populaires
   */
  async preloadPopularThemes(): Promise<void> {
    const popularThemes: VideoTheme[] = [
      'travel', 
      'lifestyle', 
      'business', 
      'nature'
    ];

    console.log('🚀 Preloading popular themes...');

    // Précharger en parallèle (mais limité pour ne pas surcharger l'API)
    const promises = popularThemes.map(async (theme) => {
      try {
        // Ne précharger que si pas déjà en cache
        if (!videoCache.has(theme)) {
          await this.getVideosByTheme(theme);
          // Petit délai entre les requêtes pour respecter les quotas
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.warn(`Failed to preload theme "${theme}":`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log('✅ Popular themes preloading completed');
  }

  /**
   * Vide le cache et force le rechargement
   */
  clearCache(): void {
    videoCache.clear();
    console.log('🗑️ Video cache cleared');
  }

  /**
   * Obtient les statistiques du service
   */
  getStats() {
    const cacheStats = videoCache.getStats();
    const apiStats = pexelsService.getUsageStats();

    return {
      cache: cacheStats,
      api: apiStats,
      totalCachedVideos: cacheStats.memory.totalVideos,
      availableThemes: cacheStats.memory.themes
    };
  }

  /**
   * Vérifie si un thème est disponible (en cache ou via API)
   */
  isThemeAvailable(theme: VideoTheme): boolean {
    // Un thème est disponible si on a une clé API ou s'il est en cache
    const apiStats = pexelsService.getUsageStats();
    return apiStats.hasApiKey || videoCache.has(theme);
  }

  /**
   * Obtient une vidéo spécifique par son ID
   */
  async getVideoById(id: string, theme: VideoTheme): Promise<VideoAsset | null> {
    try {
      const videos = await this.getVideosByTheme(theme);
      return videos.find(video => video.id === id) || null;
    } catch (error) {
      console.error(`Failed to get video ${id}:`, error);
      return null;
    }
  }

  /**
   * Filtre les vidéos par durée
   */
  filterVideosByDuration(
    videos: VideoAsset[], 
    minDuration?: number, 
    maxDuration?: number
  ): VideoAsset[] {
    return videos.filter(video => {
      if (minDuration && video.duration < minDuration) return false;
      if (maxDuration && video.duration > maxDuration) return false;
      return true;
    });
  }

  /**
   * Obtient les vidéos recommandées pour un thème
   * (combine populaires et nouvelles)
   */
  async getRecommendedVideos(theme: VideoTheme): Promise<VideoAsset[]> {
    try {
      const [popular, regular] = await Promise.all([
        this.getPopularVideosByTheme(theme),
        this.getVideosByTheme(theme)
      ]);

      // Combiner et dédupliquer
      const combined = [...popular];
      const popularIds = new Set(popular.map(v => v.id));
      
      // Ajouter les vidéos régulières qui ne sont pas déjà dans populaires
      regular.forEach(video => {
        if (!popularIds.has(video.id) && combined.length < 25) {
          combined.push(video);
        }
      });

      return combined;

    } catch (error) {
      console.error(`Failed to get recommended videos for "${theme}":`, error);
      return [];
    }
  }
}

// Instance singleton
export const videoService = new VideoService();
export default videoService; 