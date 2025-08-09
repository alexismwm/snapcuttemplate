import { VideoTheme, VideoAsset, CacheEntry, VideoCacheConfig } from '../types/video';

// Configuration par défaut du cache
const DEFAULT_CACHE_CONFIG: VideoCacheConfig = {
  maxAge: 24 * 60 * 60 * 1000, // 24 heures
  maxVideosPerTheme: 50,
  enableLocalStorage: true
};

class VideoCache {
  private memoryCache = new Map<VideoTheme, VideoAsset[]>();
  private config: VideoCacheConfig;
  private readonly STORAGE_KEY = 'snapcut_video_cache';
  private readonly STORAGE_META_KEY = 'snapcut_video_cache_meta';

  constructor(config: Partial<VideoCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.loadFromStorage();
    this.startCleanupInterval();
  }

  /**
   * Obtient les vidéos du cache pour un thème donné
   */
  get(theme: VideoTheme): VideoAsset[] | null {
    // Vérifier d'abord la mémoire
    const memoryResult = this.memoryCache.get(theme);
    if (memoryResult) {
      return memoryResult;
    }

    // Vérifier le localStorage si activé
    if (this.config.enableLocalStorage) {
      const storageResult = this.getFromStorage(theme);
      if (storageResult) {
        // Remettre en mémoire pour les prochains accès
        this.memoryCache.set(theme, storageResult);
        return storageResult;
      }
    }

    return null;
  }

  /**
   * Met en cache les vidéos pour un thème
   */
  set(theme: VideoTheme, videos: VideoAsset[]): void {
    // Limiter le nombre de vidéos par thème
    const limitedVideos = videos.slice(0, this.config.maxVideosPerTheme);
    
    // Sauvegarder en mémoire
    this.memoryCache.set(theme, limitedVideos);

    // Sauvegarder en localStorage si activé
    if (this.config.enableLocalStorage) {
      this.saveToStorage(theme, limitedVideos);
    }

    console.log(`💾 Cached ${limitedVideos.length} videos for theme "${theme}"`);
  }

  /**
   * Vérifie si un thème est en cache et valide
   */
  has(theme: VideoTheme): boolean {
    if (this.memoryCache.has(theme)) {
      return true;
    }

    if (this.config.enableLocalStorage) {
      return this.hasInStorage(theme);
    }

    return false;
  }

  /**
   * Supprime un thème du cache
   */
  delete(theme: VideoTheme): void {
    this.memoryCache.delete(theme);
    
    if (this.config.enableLocalStorage) {
      this.deleteFromStorage(theme);
    }
  }

  /**
   * Vide complètement le cache
   */
  clear(): void {
    this.memoryCache.clear();
    
    if (this.config.enableLocalStorage) {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.STORAGE_META_KEY);
      } catch (error) {
        console.warn('Failed to clear localStorage cache:', error);
      }
    }

    console.log('🗑️ Video cache cleared');
  }

  /**
   * Obtient les statistiques du cache
   */
  getStats() {
    const memoryStats = {
      themes: Array.from(this.memoryCache.keys()),
      totalVideos: Array.from(this.memoryCache.values()).reduce((sum, videos) => sum + videos.length, 0)
    };

    let storageStats: { themes: string[], totalVideos: number, sizeKB: number } = { themes: [], totalVideos: 0, sizeKB: 0 };
    
    if (this.config.enableLocalStorage) {
      try {
        const cached = localStorage.getItem(this.STORAGE_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          storageStats = {
            themes: Object.keys(data),
            totalVideos: Object.values(data).reduce((sum: number, entry: any) => sum + entry.data.length, 0),
            sizeKB: Math.round(cached.length / 1024)
          };
        }
      } catch (error) {
        console.warn('Failed to get storage stats:', error);
      }
    }

    return {
      memory: memoryStats,
      storage: storageStats,
      config: this.config
    };
  }

  /**
   * Sauvegarde en localStorage
   */
  private saveToStorage(theme: VideoTheme, videos: VideoAsset[]): void {
    try {
      const now = Date.now();
      const expiresAt = now + this.config.maxAge;

      // Charger le cache existant
      const existingCache = this.loadStorageData();
      
      // Ajouter/mettre à jour le thème
      existingCache[theme] = {
        data: videos,
        timestamp: now,
        expiresAt
      };

      // Sauvegarder
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingCache));
      
      // Mettre à jour les métadonnées
      this.updateStorageMeta();

    } catch (error) {
      console.warn(`Failed to save theme "${theme}" to localStorage:`, error);
      
      // Si erreur de quota, nettoyer le cache et réessayer
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clearExpiredFromStorage();
        try {
          const existingCache = this.loadStorageData();
          existingCache[theme] = {
            data: videos,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.config.maxAge
          };
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingCache));
        } catch (retryError) {
          console.warn('Failed to save after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Récupère depuis localStorage
   */
  private getFromStorage(theme: VideoTheme): VideoAsset[] | null {
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY);
      if (!cached) return null;

      const data: Record<VideoTheme, CacheEntry<VideoAsset[]>> = JSON.parse(cached);
      const entry = data[theme];
      
      if (!entry) return null;

      // Vérifier l'expiration
      if (Date.now() > entry.expiresAt) {
        this.deleteFromStorage(theme);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn(`Failed to load theme "${theme}" from localStorage:`, error);
      return null;
    }
  }

  /**
   * Vérifie la présence en storage
   */
  private hasInStorage(theme: VideoTheme): boolean {
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY);
      if (!cached) return false;

      const data: Record<VideoTheme, CacheEntry<VideoAsset[]>> = JSON.parse(cached);
      const entry = data[theme];
      
      return entry && Date.now() <= entry.expiresAt;
    } catch (error) {
      return false;
    }
  }

  /**
   * Supprime un thème du storage
   */
  private deleteFromStorage(theme: VideoTheme): void {
    try {
      const existingCache = this.loadStorageData();
      delete existingCache[theme];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingCache));
    } catch (error) {
      console.warn(`Failed to delete theme "${theme}" from localStorage:`, error);
    }
  }

  /**
   * Charge les données du storage
   */
  private loadStorageData(): Partial<Record<VideoTheme, CacheEntry<VideoAsset[]>>> {
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('Failed to load storage data:', error);
      return {};
    }
  }

  /**
   * Charge le cache depuis localStorage au démarrage
   */
  private loadFromStorage(): void {
    if (!this.config.enableLocalStorage) return;

    try {
      const data = this.loadStorageData();
      const now = Date.now();

      for (const [themeKey, entry] of Object.entries(data)) {
        const theme = themeKey as VideoTheme;
        if (entry && now <= entry.expiresAt) {
          this.memoryCache.set(theme, entry.data);
        }
      }

      // Nettoyer les entrées expirées
      this.clearExpiredFromStorage();

      const loadedThemes = this.memoryCache.size;
      if (loadedThemes > 0) {
        console.log(`📂 Loaded ${loadedThemes} themes from cache`);
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  /**
   * Nettoie les entrées expirées du localStorage
   */
  private clearExpiredFromStorage(): void {
    try {
      const data = this.loadStorageData();
      const now = Date.now();
      let hasExpired = false;

      for (const [themeKey, entry] of Object.entries(data)) {
        const theme = themeKey as VideoTheme;
        if (entry && now > entry.expiresAt) {
          delete data[theme];
          hasExpired = true;
        }
      }

      if (hasExpired) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        console.log('🧹 Cleaned expired cache entries');
      }
    } catch (error) {
      console.warn('Failed to clean expired cache:', error);
    }
  }

  /**
   * Met à jour les métadonnées du cache
   */
  private updateStorageMeta(): void {
    try {
      const meta = {
        lastUpdate: Date.now(),
        version: '1.0'
      };
      localStorage.setItem(this.STORAGE_META_KEY, JSON.stringify(meta));
    } catch (error) {
      // Ignore meta errors
    }
  }

  /**
   * Démarre l'intervalle de nettoyage automatique
   */
  private startCleanupInterval(): void {
    // Nettoyer toutes les heures
    setInterval(() => {
      this.clearExpiredFromStorage();
    }, 60 * 60 * 1000);
  }
}

// Instance singleton du cache
export const videoCache = new VideoCache();
export default videoCache; 