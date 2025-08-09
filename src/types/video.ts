/**
 * Types pour le système de vidéos thématiques
 */

// Nouveaux thèmes demandés par l'utilisateur
export type VideoTheme = 
  | 'Travel'
  | 'Lifestyle'
  | 'Fashion'
  | 'Retro'
  | 'Party'
  | 'Sport'
  | 'Games'
  | 'Food'
  | 'Vlog'
  | 'social';

// Configuration des thèmes
export interface ThemeConfig {
  id: VideoTheme;
  name: string;
  description: string;
  keywords: string[];
  color: string;
  icon: string;
}

// Vidéo Pexels (structure de l'API)
export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  full_link: string;
  tags: string[];
  url: string;
  image: string;
  avg_color: string;
  user: {
    id: number;
    name: string;
    url: string;
  };
  video_files: PexelsVideoFile[];
  video_pictures: PexelsVideoPicture[];
}

export interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  fps: number;
  link: string;
}

export interface PexelsVideoPicture {
  id: number;
  picture: string;
  nr: number;
}

// Réponse de l'API Pexels
export interface PexelsResponse {
  page: number;
  per_page: number;
  total_results: number;
  prev_page?: string;
  next_page?: string;
  videos: PexelsVideo[];
}

// Vidéo simplifiée pour notre usage
export interface VideoAsset {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  width: number;
  height: number;
  theme: VideoTheme;
  tags: string[];
  avgColor: string;
  author: {
    name: string;
    url: string;
  };
}

// Sélection de vidéo pour un plan
export interface VideoSelection {
  planIndex: number;
  cutId: string;
  video: VideoAsset;
}

// État des vidéos dans l'application
export interface VideoState {
  currentTheme: VideoTheme;
  availableVideos: VideoAsset[];
  selectedVideos: Map<string, VideoAsset>; // cutId -> VideoAsset
  isLoading: boolean;
  cache: Map<VideoTheme, VideoAsset[]>;
}

// Paramètres de recherche vidéo
export interface VideoSearchParams {
  theme: VideoTheme;
  page?: number;
  perPage?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  size?: 'large' | 'medium' | 'small';
  minDuration?: number;
  maxDuration?: number;
}

// Configuration du cache
export interface VideoCacheConfig {
  maxAge: number; // en millisecondes
  maxVideosPerTheme: number;
  enableLocalStorage: boolean;
}

// Métadonnées du cache
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Erreurs spécifiques aux vidéos
export class VideoServiceError extends Error {
  constructor(
    message: string,
    public code: 'API_ERROR' | 'NETWORK_ERROR' | 'QUOTA_EXCEEDED' | 'INVALID_THEME',
    public originalError?: Error
  ) {
    super(message);
    this.name = 'VideoServiceError';
  }
}

// Nouvelles interfaces pour le trimming et export avancé
export interface VideoTrimSettings {
  videoId: string;
  planIndex: number;
  startTime: number;
  endTime: number;
  originalDuration: number;
}

export interface ThumbnailConfig {
  width: number;
  height: number;
  quality: number;
  format: 'jpeg' | 'png';
}

export interface VideoExportConfig {
  compressions: {
    high: { width: number; height: number; bitrate: string };
    medium: { width: number; height: number; bitrate: string };
  };
  thumbnails: {
    large: ThumbnailConfig;
    small: ThumbnailConfig;
  };
}

export interface FinalVideoExport {
  videoBlob: Blob;
  thumbnailLarge: Blob;
  thumbnailSmall: Blob;
  metadata: {
    duration: number;
    resolution: string;
    fileSize: number;
    compression: 'high' | 'medium';
  };
} 