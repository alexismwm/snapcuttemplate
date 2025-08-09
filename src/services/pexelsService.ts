import { 
  VideoTheme, 
  VideoAsset, 
  VideoSearchParams, 
  PexelsResponse, 
  PexelsVideo,
  VideoServiceError 
} from '../types/video';

// Configuration de l'API Pexels
const PEXELS_API_URL = 'https://api.pexels.com/videos';
const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || '';

// Limites de l'API (version gratuite)
const API_LIMITS = {
  requestsPerHour: 200,
  requestsPerMonth: 20000
};

class PexelsService {
  private requestCount = 0;
  private lastResetTime = Date.now();

  /**
   * Configuration des headers pour l'API Pexels
   */
  private getHeaders(): HeadersInit {
    return {
      'Authorization': PEXELS_API_KEY,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Vérifie si on peut faire une requête (respect des quotas)
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    const hoursSinceReset = (now - this.lastResetTime) / (1000 * 60 * 60);
    
    if (hoursSinceReset >= 1) {
      // Reset du compteur toutes les heures
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    return this.requestCount < API_LIMITS.requestsPerHour;
  }

  /**
   * Transforme une vidéo Pexels en VideoAsset
   */
  private transformPexelsVideo(pexelsVideo: PexelsVideo, theme: VideoTheme): VideoAsset {
    // Trouver la meilleure qualité vidéo (préférer HD)
    const bestVideo = pexelsVideo.video_files
      .filter(file => file.file_type === 'video/mp4')
      .sort((a, b) => {
        // Prioriser HD puis par taille
        if (a.quality === 'hd' && b.quality !== 'hd') return -1;
        if (b.quality === 'hd' && a.quality !== 'hd') return 1;
        return (b.width * b.height) - (a.width * a.height);
      })[0];

    // Thumbnail (première image disponible)
    const thumbnail = pexelsVideo.video_pictures[0]?.picture || pexelsVideo.image;

    return {
      id: pexelsVideo.id.toString(),
      title: pexelsVideo.tags.slice(0, 3).join(' ') || 'Video',
      thumbnail,
      videoUrl: bestVideo?.link || '',
      duration: pexelsVideo.duration,
      width: pexelsVideo.width,
      height: pexelsVideo.height,
      theme,
      tags: pexelsVideo.tags,
      avgColor: pexelsVideo.avg_color,
      author: {
        name: pexelsVideo.user.name,
        url: pexelsVideo.user.url
      }
    };
  }

  /**
   * Recherche de vidéos par thème avec mots-clés personnalisés
   */
  async searchVideosByTheme(params: VideoSearchParams, customKeywords?: string[]): Promise<VideoAsset[]> {
    if (!PEXELS_API_KEY) {
      console.warn('🔑 Pexels API key not found. Using mock data.');
      return this.getMockVideos(params.theme);
    }

    if (!this.canMakeRequest()) {
      throw new VideoServiceError(
        'API quota exceeded. Please try again later.',
        'QUOTA_EXCEEDED'
      );
    }

    try {
      // Combiner mots-clés du thème avec mots-clés personnalisés
      let allKeywords = this.getThemeKeywords(params.theme);
      if (customKeywords && customKeywords.length > 0) {
        allKeywords = [...customKeywords, ...allKeywords.slice(0, 2)]; // Priorité aux custom keywords
      }
      
      const searchQuery = allKeywords.join(' ');
      const url = new URL(`${PEXELS_API_URL}/search`);
      
      // Paramètres de recherche
      url.searchParams.set('query', searchQuery);
      url.searchParams.set('per_page', (params.perPage || 15).toString());
      url.searchParams.set('page', (params.page || 1).toString());
      
      if (params.orientation) {
        url.searchParams.set('orientation', params.orientation);
      }
      
      if (params.size) {
        url.searchParams.set('size', params.size);
      }

      const response = await fetch(url.toString(), {
        headers: this.getHeaders()
      });

      this.requestCount++;

      if (!response.ok) {
        if (response.status === 429) {
          throw new VideoServiceError(
            'Too many requests. Please wait before trying again.',
            'QUOTA_EXCEEDED'
          );
        }
        throw new VideoServiceError(
          `API request failed: ${response.status}`,
          'API_ERROR'
        );
      }

      const data: PexelsResponse = await response.json();
      
      const videos = data.videos
        .filter(video => {
          // Filtrer par durée si spécifié
          if (params.minDuration && video.duration < params.minDuration) return false;
          if (params.maxDuration && video.duration > params.maxDuration) return false;
          return true;
        })
        .map(video => this.transformPexelsVideo(video, params.theme))
        .filter(video => video.videoUrl); // S'assurer qu'on a une URL valide

      const keywordInfo = customKeywords && customKeywords.length > 0 
        ? ` with keywords: [${customKeywords.join(', ')}]` 
        : '';
      console.log(`🎬 Loaded ${videos.length} videos for theme "${params.theme}"${keywordInfo}`);
      return videos;

    } catch (error) {
      if (error instanceof VideoServiceError) {
        throw error;
      }
      
      console.error('Pexels API error:', error);
      throw new VideoServiceError(
        'Failed to fetch videos from Pexels',
        'NETWORK_ERROR',
        error as Error
      );
    }
  }

  /**
   * Vidéos populaires par thème
   */
  async getPopularVideos(theme: VideoTheme, limit = 20): Promise<VideoAsset[]> {
    if (!PEXELS_API_KEY) {
      return this.getMockVideos(theme, limit);
    }

    if (!this.canMakeRequest()) {
      throw new VideoServiceError(
        'API quota exceeded. Please try again later.',
        'QUOTA_EXCEEDED'
      );
    }

    try {
      const url = new URL(`${PEXELS_API_URL}/popular`);
      url.searchParams.set('per_page', limit.toString());

      const response = await fetch(url.toString(), {
        headers: this.getHeaders()
      });

      this.requestCount++;

      if (!response.ok) {
        throw new VideoServiceError(
          `Failed to fetch popular videos: ${response.status}`,
          'API_ERROR'
        );
      }

      const data: PexelsResponse = await response.json();
      const keywords = this.getThemeKeywords(theme);
      
      // Filtrer les vidéos populaires par thème
      const filteredVideos = data.videos
        .filter(video => {
          const videoTags = video.tags.map(tag => tag.toLowerCase());
          return keywords.some(keyword => 
            videoTags.some(tag => tag.includes(keyword.toLowerCase()))
          );
        })
        .slice(0, limit)
        .map(video => this.transformPexelsVideo(video, theme))
        .filter(video => video.videoUrl);

      console.log(`🔥 Loaded ${filteredVideos.length} popular videos for theme "${theme}"`);
      return filteredVideos;

    } catch (error) {
      if (error instanceof VideoServiceError) {
        throw error;
      }
      
      console.error('Popular videos API error:', error);
      return this.getMockVideos(theme, limit);
    }
  }

  /**
   * Mots-clés par thème pour les recherches Pexels
   */
  private getThemeKeywords(theme: VideoTheme): string[] {
    const themeKeywords: Record<VideoTheme, string[]> = {
      'Travel': ['travel', 'vacation', 'adventure', 'destination', 'journey', 'explore', 'wanderlust', 'tourism'],
      'Lifestyle': ['lifestyle', 'home', 'family', 'daily life', 'routine', 'comfort', 'living', 'modern life'],
      'Fashion': ['fashion', 'style', 'clothing', 'model', 'trendy', 'outfit', 'runway', 'designer'],
      'Retro': ['retro', 'vintage', 'classic', 'old school', 'nostalgic', '80s', '90s', 'throwback'],
      'Party': ['party', 'celebration', 'dancing', 'nightlife', 'fun', 'festive', 'music', 'crowd'],
      'Sport': ['sport', 'fitness', 'exercise', 'athletic', 'training', 'competition', 'active', 'gym'],
      'Games': ['gaming', 'video games', 'esports', 'console', 'player', 'competition', 'online', 'fun'],
      'Food': ['food', 'cooking', 'cuisine', 'restaurant', 'chef', 'delicious', 'dining', 'meal'],
      'Vlog': ['vlog', 'blogger', 'camera', 'content', 'creator', 'recording', 'social media', 'lifestyle'],
      'social': ['social media', 'community', 'people', 'connection', 'sharing', 'networking', 'friends', 'online']
    };

    return themeKeywords[theme] || ['video', 'content'];
  }

  /**
   * Données de démonstration si pas d'API key
   */
  private getMockVideos(theme: VideoTheme, limit = 15): VideoAsset[] {
    const mockData: VideoAsset[] = Array.from({ length: limit }, (_, i) => ({
      id: `mock-${theme}-${i}`,
      title: `${theme} video ${i + 1}`,
      thumbnail: `https://picsum.photos/400/300?random=${theme}${i}`,
      videoUrl: `https://player.vimeo.com/external/291648067.hd.mp4?s=94998971682c6a3267e4cbd19d16a7b6c720f345&profile_id=175`,
      duration: 15 + Math.random() * 30,
      width: 1920,
      height: 1080,
      theme,
      tags: this.getThemeKeywords(theme).slice(0, 3),
      avgColor: '#' + Math.floor(Math.random()*16777215).toString(16),
      author: {
        name: `Mock Author ${i + 1}`,
        url: '#'
      }
    }));

    console.log(`🎭 Using mock data: ${mockData.length} videos for theme "${theme}"`);
    return mockData;
  }

  /**
   * Obtient les statistiques d'utilisation de l'API
   */
  getUsageStats() {
    const hoursSinceReset = (Date.now() - this.lastResetTime) / (1000 * 60 * 60);
    return {
      requestsThisHour: this.requestCount,
      maxRequestsPerHour: API_LIMITS.requestsPerHour,
      timeUntilReset: Math.max(0, 60 - (hoursSinceReset * 60)), // minutes
      hasApiKey: !!PEXELS_API_KEY
    };
  }
}

// Instance singleton
export const pexelsService = new PexelsService();
export default pexelsService; 