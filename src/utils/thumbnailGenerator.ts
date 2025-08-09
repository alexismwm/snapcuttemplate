import { ThumbnailConfig } from '../types/video';

/**
 * Configuration par défaut pour les thumbnails
 */
export const DEFAULT_THUMBNAIL_CONFIGS: {
  large: ThumbnailConfig;
  small: ThumbnailConfig;
} = {
  large: {
    width: 1080,
    height: 1920,
    quality: 0.9,
    format: 'jpeg'
  },
  small: {
    width: 540,
    height: 960,
    quality: 0.8,
    format: 'jpeg'
  }
};

/**
 * Génère un thumbnail JPEG à partir d'une vidéo au temps spécifié
 */
export async function generateVideoThumbnail(
  video: HTMLVideoElement,
  config: ThumbnailConfig,
  timeSeconds: number = 0
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // S'assurer que la vidéo est chargée
    if (video.readyState < video.HAVE_CURRENT_DATA) {
      const handleLoadedData = () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        generateThumbnailFromVideo(video, config, timeSeconds)
          .then(resolve)
          .catch(reject);
      };
      video.addEventListener('loadeddata', handleLoadedData);
      return;
    }

    generateThumbnailFromVideo(video, config, timeSeconds)
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Génère le thumbnail à partir d'une vidéo déjà chargée
 */
async function generateThumbnailFromVideo(
  video: HTMLVideoElement,
  config: ThumbnailConfig,
  timeSeconds: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Créer un canvas avec les dimensions spécifiées
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      canvas.width = config.width;
      canvas.height = config.height;

      // Sauvegarder le temps actuel de la vidéo
      const originalTime = video.currentTime;

      // Handler pour quand la vidéo atteint le temps souhaité
      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);
        
        try {
          // Calculer les dimensions pour maintenir le ratio d'aspect
          const videoAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = config.width / config.height;
          
          let drawWidth = config.width;
          let drawHeight = config.height;
          let offsetX = 0;
          let offsetY = 0;

          if (videoAspect > canvasAspect) {
            // Vidéo plus large, ajuster la largeur
            drawWidth = config.height * videoAspect;
            offsetX = (config.width - drawWidth) / 2;
          } else {
            // Vidéo plus haute, ajuster la hauteur  
            drawHeight = config.width / videoAspect;
            offsetY = (config.height - drawHeight) / 2;
          }

          // Remplir le fond en noir
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, config.width, config.height);

          // Dessiner la vidéo sur le canvas
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

          // Convertir en blob
          canvas.toBlob(
            (blob) => {
              // Restaurer le temps original de la vidéo
              video.currentTime = originalTime;
              
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create thumbnail blob'));
              }
            },
            `image/${config.format}`,
            config.quality
          );
        } catch (error) {
          video.currentTime = originalTime;
          reject(error);
        }
      };

      // Aller au temps spécifié
      video.addEventListener('seeked', handleSeeked);
      video.currentTime = Math.max(0, Math.min(timeSeconds, video.duration - 0.1));
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Génère les deux thumbnails (large et small) pour une vidéo
 */
export async function generateVideoThumbnails(
  video: HTMLVideoElement,
  timeSeconds: number = 0,
  customConfigs?: { large?: Partial<ThumbnailConfig>; small?: Partial<ThumbnailConfig> }
): Promise<{ large: Blob; small: Blob }> {
  const largeConfig = { ...DEFAULT_THUMBNAIL_CONFIGS.large, ...customConfigs?.large };
  const smallConfig = { ...DEFAULT_THUMBNAIL_CONFIGS.small, ...customConfigs?.small };

  try {
    // Générer les deux thumbnails en parallèle pour optimiser les performances
    const [large, small] = await Promise.all([
      generateVideoThumbnail(video, largeConfig, timeSeconds),
      generateVideoThumbnail(video, smallConfig, timeSeconds)
    ]);

    return { large, small };
  } catch (error) {
    console.error('Failed to generate thumbnails:', error);
    throw new Error(`Thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Génère un thumbnail à partir d'une URL de vidéo
 */
export async function generateThumbnailFromUrl(
  videoUrl: string,
  config: ThumbnailConfig,
  timeSeconds: number = 0
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    const handleLoadedMetadata = async () => {
      try {
        const thumbnail = await generateVideoThumbnail(video, config, timeSeconds);
        resolve(thumbnail);
      } catch (error) {
        reject(error);
      } finally {
        // Nettoyer
        video.remove();
      }
    };

    const handleError = () => {
      video.remove();
      reject(new Error(`Failed to load video from URL: ${videoUrl}`));
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    
    video.src = videoUrl;
  });
}

/**
 * Télécharge un blob comme fichier
 */
export function downloadThumbnail(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Nettoyer l'URL après un délai
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Génère un nom de fichier pour un thumbnail
 */
export function generateThumbnailFilename(
  projectName: string,
  size: 'large' | 'small',
  config: ThumbnailConfig
): string {
  return `${projectName}_thumbnail_${size}_${config.width}x${config.height}.${config.format}`;
} 