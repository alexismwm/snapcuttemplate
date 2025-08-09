import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { VideoAsset, VideoExportConfig, FinalVideoExport } from '../types/video';
import { CutMarker } from '../types';
import { generateVideoThumbnails, DEFAULT_THUMBNAIL_CONFIGS } from '../utils/thumbnailGenerator';

// Helper to compute absolute URL (avoids SPA rewrites interfering with /ffmpeg)
function absolute(url: string): string {
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

interface VideoSegment {
  planIndex: number;
  video: VideoAsset;
  startTime: number;
  endTime: number;
  trimSettings?: {
    startTime: number;
    endTime: number;
  };
}

interface ExportProgress {
  stage: 'initializing' | 'downloading' | 'processing' | 'encoding' | 'thumbnails' | 'complete';
  progress: number;
  message: string;
}

export class VideoEditor {
  private ffmpeg: FFmpeg;
  private isLoaded = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  /**
   * Initialise FFmpeg avec les callbacks de progression
   */
  async initialize(onProgress?: (progress: ExportProgress) => void): Promise<void> {
    if (this.isLoaded) return;

    try {
      onProgress?.({ stage: 'initializing', progress: 0, message: 'Loading FFmpeg...' });

      // Basic diagnostic for cross-origin isolation
      const hasSAB = typeof (window as any).SharedArrayBuffer !== 'undefined';
      if (!hasSAB) {
        console.warn('SharedArrayBuffer not available. Check COOP/COEP headers.');
      }

      // Try local files first (no CORS issues)
      let loaded = false;
      
      try {
        onProgress?.({ stage: 'initializing', progress: 25, message: 'Loading FFmpeg from local files...' });

        const coreURL = await toBlobURL(absolute('/ffmpeg/ffmpeg-core.js'), 'text/javascript');
        const wasmURL = await toBlobURL(absolute('/ffmpeg/ffmpeg-core.wasm'), 'application/wasm');
        const workerURL = await toBlobURL(absolute('/ffmpeg/ffmpeg-core.worker.js'), 'text/javascript');

        await this.ffmpeg.load({ coreURL, wasmURL, workerURL });
        
        loaded = true;
        console.log('✅ FFmpeg loaded successfully from local files');
      } catch (localError) {
        console.warn('❌ Failed to load local FFmpeg, trying CDN fallback:', localError);
        
        // Fallback to CDN URLs
        const cdnUrls = [
          'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
          'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
          'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.10/umd'
        ];

        for (const baseURL of cdnUrls) {
          try {
            onProgress?.({ stage: 'initializing', progress: 50, message: `Loading FFmpeg from ${baseURL} (fallback)...` });

            const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
            const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
            // Worker naming can vary across CDNs; try alternatives
            let workerURL: string | undefined;
            try {
              workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');
            } catch {
              workerURL = await toBlobURL(`${baseURL}/814.ffmpeg.js`, 'text/javascript');
            }

            await this.ffmpeg.load({ coreURL, wasmURL, workerURL });
            
            loaded = true;
            console.log(`✅ FFmpeg loaded successfully from ${baseURL}`);
            break;
          } catch (error) {
            console.warn(`❌ Failed to load FFmpeg from ${baseURL}:`, error);
            if (baseURL === cdnUrls[cdnUrls.length - 1]) {
              throw new Error('All FFmpeg sources failed. Please check your internet connection and SharedArrayBuffer support.');
            }
          }
        }
      }

      if (!loaded) {
        throw new Error('Failed to load FFmpeg from all sources');
      }

      // Set up progress callback
      this.ffmpeg.on('progress', ({ progress }) => {
        onProgress?.({ stage: 'encoding', progress: Math.round(progress * 100), message: `Encoding video... ${Math.round(progress * 100)}%` });
      });

      this.isLoaded = true;
      onProgress?.({ stage: 'initializing', progress: 100, message: 'FFmpeg loaded successfully' });

    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error('Failed to initialize video editor');
    }
  }

  /**
   * Crée les segments vidéo à partir des cut markers
   */
  private createVideoSegments(
    cutMarkers: CutMarker[],
    videoAssignments: Map<number, VideoAsset>,
    startTime: number,
    endTime: number,
    videoTrims: Map<number, { startTime: number; endTime: number }>
  ): VideoSegment[] {
    const segments: VideoSegment[] = [];
    const sortedCuts = [...cutMarkers].sort((a, b) => a.time - b.time);

    // Premier segment (Plan 1)
    const firstCutTime = sortedCuts.length > 0 ? sortedCuts[0].time : endTime;
    const plan1Video = videoAssignments.get(1);
    if (plan1Video) {
      segments.push({
        planIndex: 1,
        video: plan1Video,
        startTime: startTime,
        endTime: Math.min(firstCutTime, endTime),
        trimSettings: videoTrims.get(1)
      });
    }

    // Segments suivants
    for (let i = 0; i < sortedCuts.length; i++) {
      const cut = sortedCuts[i];
      const nextCut = sortedCuts[i + 1];
      const planIndex = i + 2;
      const planVideo = videoAssignments.get(planIndex);

      if (planVideo && cut.time < endTime) {
        segments.push({
          planIndex,
          video: planVideo,
          startTime: Math.max(cut.time, startTime),
          endTime: Math.min(nextCut ? nextCut.time : endTime, endTime),
          trimSettings: videoTrims.get(planIndex)
        });
      }
    }

    return segments.filter(segment => segment.endTime > segment.startTime);
  }

  /**
   * Télécharge et prépare les fichiers vidéo
   */
  private async downloadAndPrepareVideos(
    segments: VideoSegment[],
    onProgress?: (progress: ExportProgress) => void
  ): Promise<void> {
    onProgress?.({
      stage: 'downloading',
      progress: 0,
      message: `Downloading ${segments.length} videos...`
    });

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      try {
        onProgress?.({
          stage: 'downloading',
          progress: (i / segments.length) * 100,
          message: `Downloading video ${i + 1}/${segments.length}...`
        });

        // Télécharger la vidéo
        const videoData = await fetchFile(segment.video.videoUrl);
        await this.ffmpeg.writeFile(`video_${segment.planIndex}.mp4`, videoData);

      } catch (error) {
        console.warn(`Failed to download video ${segment.planIndex}:`, error);
        throw new Error(`Failed to download video for plan ${segment.planIndex}`);
      }
    }
  }

  /**
   * Génère la commande FFmpeg pour assembler les vidéos
   */
  private generateFFmpegCommand(
    segments: VideoSegment[],
    audioFile: File,
    config: VideoExportConfig,
    compression: 'high' | 'medium'
  ): string[] {
    const compConfig = config.compressions[compression];
    const command: string[] = [];

    // Inputs pour chaque segment vidéo
    segments.forEach((segment, index) => {
      command.push('-i', `video_${segment.planIndex}.mp4`);
    });

    // Input audio
    command.push('-i', 'audio.wav');

    // Créer le filtre complexe pour concaténer les vidéos
    const filterComplex: string[] = [];
    
    segments.forEach((segment, index) => {
      const duration = segment.endTime - segment.startTime;
      const trimStart = segment.trimSettings?.startTime || 0;
      const trimEnd = segment.trimSettings?.endTime || segment.video.duration;
      const trimDuration = Math.min(trimEnd - trimStart, duration);

      // Trimmer et redimensionner chaque vidéo
      filterComplex.push(
        `[${index}:v]trim=start=${trimStart}:duration=${trimDuration},setpts=PTS-STARTPTS,scale=${compConfig.width}:${compConfig.height}:force_original_aspect_ratio=decrease,pad=${compConfig.width}:${compConfig.height}:(ow-iw)/2:(oh-ih)/2[v${index}]`
      );
    });

    // Concaténer toutes les vidéos
    const concatInputs = segments.map((_, index) => `[v${index}]`).join('');
    filterComplex.push(`${concatInputs}concat=n=${segments.length}:v=1:a=0[outv]`);

    command.push('-filter_complex', filterComplex.join(';'));

    // Map les streams
    command.push('-map', '[outv]');
    command.push('-map', `${segments.length}:a`); // Audio stream

    // Paramètres d'encodage
    command.push('-c:v', 'libx264');
    command.push('-b:v', compConfig.bitrate);
    command.push('-c:a', 'aac');
    command.push('-b:a', '128k');
    command.push('-movflags', '+faststart');
    command.push('-shortest');

    command.push(`output_${compression}.mp4`);

    return command;
  }

  /**
   * Exporte une vidéo finale avec audio
   */
  async exportFinalVideo(
    cutMarkers: CutMarker[],
    videoAssignments: Map<number, VideoAsset>,
    audioFile: File,
    audioStartTime: number,
    audioEndTime: number,
    videoTrims: Map<number, { startTime: number; endTime: number }> = new Map(),
    compression: 'high' | 'medium' = 'high',
    config: VideoExportConfig = {
      compressions: {
        high: { width: 720, height: 1280, bitrate: '2M' },    // 720p HD
        medium: { width: 360, height: 640, bitrate: '800k' }  // 360p SD
      },
      thumbnails: DEFAULT_THUMBNAIL_CONFIGS
    },
    onProgress?: (progress: ExportProgress) => void
  ): Promise<FinalVideoExport> {
    try {
      // Initialiser FFmpeg
      await this.initialize(onProgress);

      // Créer les segments vidéo
      const segments = this.createVideoSegments(
        cutMarkers,
        videoAssignments,
        audioStartTime,
        audioEndTime,
        videoTrims
      );

      if (segments.length === 0) {
        throw new Error('No video segments to export');
      }

      onProgress?.({
        stage: 'processing',
        progress: 0,
        message: 'Preparing video export...'
      });

      // Télécharger et préparer les vidéos
      await this.downloadAndPrepareVideos(segments, onProgress);

      // Préparer l'audio
      const audioData = await fetchFile(audioFile);
      await this.ffmpeg.writeFile('audio.wav', audioData);

      onProgress?.({
        stage: 'encoding',
        progress: 0,
        message: 'Encoding final video...'
      });

      // Générer et exécuter la commande FFmpeg
      const ffmpegCommand = this.generateFFmpegCommand(segments, audioFile, config, compression);
      await this.ffmpeg.exec(ffmpegCommand);

      // Récupérer la vidéo finale
      const videoData = await this.ffmpeg.readFile(`output_${compression}.mp4`);
      const videoBlob = new Blob([videoData], { type: 'video/mp4' });

      onProgress?.({
        stage: 'thumbnails',
        progress: 0,
        message: 'Generating thumbnails...'
      });

      // Générer les thumbnails à partir de la première vidéo
      const firstVideo = document.createElement('video');
      firstVideo.src = segments[0].video.videoUrl;
      firstVideo.crossOrigin = 'anonymous';

      await new Promise((resolve) => {
        firstVideo.addEventListener('loadedmetadata', resolve);
        firstVideo.load();
      });

      const thumbnails = await generateVideoThumbnails(
        firstVideo,
        segments[0].trimSettings?.startTime || 0,
        config.thumbnails
      );

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Export complete!'
      });

      const compConfig = config.compressions[compression];
      
      return {
        videoBlob,
        thumbnailLarge: thumbnails.large,
        thumbnailSmall: thumbnails.small,
        metadata: {
          duration: audioEndTime - audioStartTime,
          resolution: `${compConfig.width}x${compConfig.height}`,
          fileSize: videoBlob.size,
          compression
        }
      };

    } catch (error) {
      console.error('Video export failed:', error);
      throw new Error(`Video export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Nettoie les fichiers temporaires
   */
  async cleanup(): Promise<void> {
    try {
      // Lister tous les fichiers et les supprimer
      const files = await this.ffmpeg.listDir('/');
      for (const file of files) {
        if (file.name !== '.' && file.name !== '..') {
          await this.ffmpeg.deleteFile(file.name);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup temporary files:', error);
    }
  }
}

// Instance singleton pour réutiliser FFmpeg
export const videoEditor = new VideoEditor(); 