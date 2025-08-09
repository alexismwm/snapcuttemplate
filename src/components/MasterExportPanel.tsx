import React, { useState, useCallback, useMemo } from 'react';
import { Download, Loader, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { CutMarker, AudioFile } from '../types';
import { VideoAsset } from '../types/video';
import { FileNamingService, ProjectSettings } from '../services/fileNamingService';
import { trimAudioFile } from '../utils/audioTrimmer';
import { generateVideoThumbnails, downloadThumbnail } from '../utils/thumbnailGenerator';
import { videoEditor } from '../services/videoEditor';
import { detectSharedArrayBuffer, logSharedArrayBufferDiagnostic } from '../utils/sharedarraybuffer-detection';

interface MasterExportPanelProps {
  audioFile: AudioFile;
  cutMarkers: CutMarker[];
  startTime: number;
  endTime: number;
  videoAssignments: Map<number, VideoAsset>;
  videoTrimSettings: Map<number, { startTime: number; endTime: number }>;
}

interface ExportProgress {
  step: string;
  progress: number;
  message: string;
  isComplete: boolean;
}

interface ExportStatus {
  json: 'pending' | 'success' | 'error';
  audio: 'pending' | 'success' | 'error';
  video720p: 'pending' | 'success' | 'error';
  video360p: 'pending' | 'success' | 'error';
  thumbnailLarge: 'pending' | 'success' | 'error';
  thumbnailSmall: 'pending' | 'success' | 'error';
}

export const MasterExportPanel: React.FC<MasterExportPanelProps> = ({
  audioFile,
  cutMarkers,
  startTime,
  endTime,
  videoAssignments,
  videoTrimSettings
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>({
    json: 'pending',
    audio: 'pending',
    video720p: 'pending',
    video360p: 'pending',
    thumbnailLarge: 'pending',
    thumbnailSmall: 'pending',
  });
  const [error, setError] = useState<string | null>(null);

  // Export Settings - Extract from DOM or use defaults
  const exportSettings = useMemo(() => {
    return FileNamingService.extractSettingsFromDOM() || {
      category: 'Travel',
      templateNumber: '006',
      musicId: '012'
    };
  }, []);

  const canExport = useMemo(() => {
    const duration = endTime - startTime;
    const hasValidDuration = duration > 0 && duration <= 60;
    const hasVideos = videoAssignments.size > 0;
    const hasAudio = !!audioFile;
    
    return hasValidDuration && hasVideos && hasAudio;
  }, [audioFile, videoAssignments.size, startTime, endTime]);

  const updateProgress = useCallback((step: string, progress: number, message: string, isComplete = false) => {
    setExportProgress({ step, progress, message, isComplete });
  }, []);

  const updateStatus = useCallback((key: keyof ExportStatus, status: 'pending' | 'success' | 'error') => {
    setExportStatus(prev => ({ ...prev, [key]: status }));
  }, []);

  const generateSnapcutJSON = useCallback(() => {
    const now = Date.now() / 1000;
    const trimmedDuration = endTime - startTime;
    const namingContext = FileNamingService.createContext(exportSettings, cutMarkers, trimmedDuration);
    const audioFileName = FileNamingService.generateMusicFilename(namingContext, startTime, endTime);

    // Create video segments based on cut markers
    const sortedCuts = [...cutMarkers].sort((a, b) => a.time - b.time);
    const mainTimeline: any[] = [];
    
    // First segment (Plan 1)
    const firstCutTime = sortedCuts.length > 0 ? sortedCuts[0].time : endTime;
    const firstDuration = Math.min(firstCutTime, endTime) - startTime;
    
    if (firstDuration > 0) {
      mainTimeline.push({
        duration: firstDuration,
        startTime: 0,
        mediaType: 'video',
        fileName: 'placeholder_video_1.mp4',
        playbackSpeed: 1,
        isMuted: true
      });
    }

    // Subsequent segments
    for (let i = 0; i < sortedCuts.length; i++) {
      const cut = sortedCuts[i];
      const nextCut = sortedCuts[i + 1];
      const segmentEnd = nextCut ? Math.min(nextCut.time, endTime) : endTime;
      const segmentDuration = segmentEnd - cut.time;
      
      if (segmentDuration > 0) {
        mainTimeline.push({
          duration: segmentDuration,
          startTime: cut.time - startTime,
          mediaType: 'video',
          fileName: `placeholder_video_${i + 2}.mp4`,
          playbackSpeed: 1,
          isMuted: true
        });
      }
    }

    return {
      id: crypto.randomUUID().toUpperCase(),
      title: FileNamingService.generateProjectFilename(namingContext).replace('.json', ''),
      lastModificationDate: now,
      editionProject: {
        mainTimeline,
        aspectRatio: { r_9_16: {} },
        superpositionTimeline: [],
        audioTimeline: [{
          duration: trimmedDuration,
          startTime: 0,
          fileName: audioFileName,
          gain: 1,
          playbackSpeed: 1,
          fileTrimStart: startTime,
          isMuted: false
        }]
      }
    };
  }, [audioFile, cutMarkers, startTime, endTime, exportSettings]);

  const exportAll = useCallback(async () => {
    if (!canExport) return;

    setIsExporting(true);
    setError(null);
    setExportStatus({
      json: 'pending',
      audio: 'pending',
      video720p: 'pending',
      video360p: 'pending',
      thumbnailLarge: 'pending',
      thumbnailSmall: 'pending',
    });

    try {
      const namingContext = FileNamingService.createContext(exportSettings, cutMarkers, endTime - startTime);

      // 1. Export JSON
      updateProgress('JSON Export', 10, 'Generating Snapcut project file...');
      try {
        const snapcutData = generateSnapcutJSON();
        const jsonBlob = new Blob([JSON.stringify(snapcutData, null, 2)], { type: 'application/json' });
        const jsonFilename = FileNamingService.generateProjectFilename(namingContext);
        
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = jsonFilename;
        document.body.appendChild(jsonLink);
        jsonLink.click();
        document.body.removeChild(jsonLink);
        URL.revokeObjectURL(jsonUrl);
        
        updateStatus('json', 'success');
      } catch (error) {
        updateStatus('json', 'error');
        throw new Error(`JSON export failed: ${error}`);
      }

      // 2. Export Audio
      updateProgress('Audio Export', 25, 'Trimming and exporting audio...');
      try {
        const trimmedAudioBlob = await trimAudioFile(audioFile.file, {
          startTime,
          endTime,
          originalFileName: audioFile.name
        });
        
        const audioFilename = FileNamingService.generateMusicFilename(namingContext, startTime, endTime);
        const audioUrl = URL.createObjectURL(trimmedAudioBlob);
        const audioLink = document.createElement('a');
        audioLink.href = audioUrl;
        audioLink.download = audioFilename;
        document.body.appendChild(audioLink);
        audioLink.click();
        document.body.removeChild(audioLink);
        URL.revokeObjectURL(audioUrl);
        
        updateStatus('audio', 'success');
      } catch (error) {
        updateStatus('audio', 'error');
        throw new Error(`Audio export failed: ${error}`);
      }

      // 3. Export Videos (720p and 360p) with fallback
      updateProgress('Video Export', 40, 'Initializing video export...');
      
      let hasVideoExportError = false;
      let videoExportErrorMessage = '';

      try {
        // 720p Export
        updateProgress('Video Export', 45, 'Exporting 720p video...');
        const video720p = await videoEditor.exportFinalVideo(
          cutMarkers,
          videoAssignments,
          audioFile.file,
          startTime,
          endTime,
          videoTrimSettings,
          'high', // 720p
          {
            compressions: {
              high: { width: 720, height: 1280, bitrate: '2M' },
              medium: { width: 360, height: 640, bitrate: '800k' }
            },
            thumbnails: {
              large: { width: 1080, height: 1920, quality: 0.9, format: 'jpeg' as const },
              small: { width: 540, height: 960, quality: 0.8, format: 'jpeg' as const }
            }
          },
          (progress) => {
            if (progress.stage === 'encoding') {
              updateProgress('Video Export', 45 + (progress.progress * 15), `720p: ${progress.message}`);
            }
          }
        );

        // Download 720p
        const video720pFilename = FileNamingService.generateFinalVideoFilename(namingContext, 'high');
        const video720pUrl = URL.createObjectURL(video720p.videoBlob);
        const video720pLink = document.createElement('a');
        video720pLink.href = video720pUrl;
        video720pLink.download = video720pFilename;
        document.body.appendChild(video720pLink);
        video720pLink.click();
        document.body.removeChild(video720pLink);
        URL.revokeObjectURL(video720pUrl);
        
        updateStatus('video720p', 'success');

        // 360p Export
        updateProgress('Video Export', 65, 'Exporting 360p video...');
        const video360p = await videoEditor.exportFinalVideo(
          cutMarkers,
          videoAssignments,
          audioFile.file,
          startTime,
          endTime,
          videoTrimSettings,
          'medium', // 360p
          {
            compressions: {
              high: { width: 720, height: 1280, bitrate: '2M' },
              medium: { width: 360, height: 640, bitrate: '800k' }
            },
            thumbnails: {
              large: { width: 1080, height: 1920, quality: 0.9, format: 'jpeg' as const },
              small: { width: 540, height: 960, quality: 0.8, format: 'jpeg' as const }
            }
          },
          (progress) => {
            if (progress.stage === 'encoding') {
              updateProgress('Video Export', 65 + (progress.progress * 15), `360p: ${progress.message}`);
            }
          }
        );

        // Download 360p
        const video360pFilename = FileNamingService.generateFinalVideoFilename(namingContext, 'medium');
        const video360pUrl = URL.createObjectURL(video360p.videoBlob);
        const video360pLink = document.createElement('a');
        video360pLink.href = video360pUrl;
        video360pLink.download = video360pFilename;
        document.body.appendChild(video360pLink);
        video360pLink.click();
        document.body.removeChild(video360pLink);
        URL.revokeObjectURL(video360pUrl);
        
        updateStatus('video360p', 'success');

        // 4. Export Thumbnails (from 720p video)
        updateProgress('Thumbnails', 85, 'Generating thumbnails...');
        
        // Download Large Thumbnail
        const largeThumbnailFilename = FileNamingService.generateThumbnailFilename(namingContext, 'large', 1080, 1920, 'jpeg');
        downloadThumbnail(video720p.thumbnailLarge, largeThumbnailFilename);
        updateStatus('thumbnailLarge', 'success');

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Download Small Thumbnail
        const smallThumbnailFilename = FileNamingService.generateThumbnailFilename(namingContext, 'small', 540, 960, 'jpeg');
        downloadThumbnail(video720p.thumbnailSmall, smallThumbnailFilename);
        updateStatus('thumbnailSmall', 'success');

      } catch (error) {
        console.warn('Video export failed, continuing with fallback mode:', error);
        hasVideoExportError = true;
        videoExportErrorMessage = error instanceof Error ? error.message : 'Unknown video export error';
        
        updateStatus('video720p', 'error');
        updateStatus('video360p', 'error');
        
                 // Fallback: Generate thumbnails from the first video
         try {
           updateProgress('Thumbnails', 85, 'Generating thumbnails (fallback mode)...');
           
           const firstVideo = videoAssignments.get(1);
           if (firstVideo) {
             const { generateThumbnailFromUrl, downloadThumbnail } = await import('../utils/thumbnailGenerator');
             
             // Generate Large Thumbnail
             const largeThumbnail = await generateThumbnailFromUrl(firstVideo.videoUrl, {
               width: 1080, 
               height: 1920, 
               quality: 0.9, 
               format: 'jpeg' as const
             });

             // Download Large Thumbnail
             const largeThumbnailFilename = FileNamingService.generateThumbnailFilename(namingContext, 'large', 1080, 1920, 'jpeg');
             downloadThumbnail(largeThumbnail, largeThumbnailFilename);
             updateStatus('thumbnailLarge', 'success');

             // Small delay between downloads
             await new Promise(resolve => setTimeout(resolve, 500));
             
             // Generate Small Thumbnail
             const smallThumbnail = await generateThumbnailFromUrl(firstVideo.videoUrl, {
               width: 540, 
               height: 960, 
               quality: 0.8, 
               format: 'jpeg' as const
             });
             
             // Download Small Thumbnail
             const smallThumbnailFilename = FileNamingService.generateThumbnailFilename(namingContext, 'small', 540, 960, 'jpeg');
             downloadThumbnail(smallThumbnail, smallThumbnailFilename);
             updateStatus('thumbnailSmall', 'success');
           } else {
             updateStatus('thumbnailLarge', 'error');
             updateStatus('thumbnailSmall', 'error');
           }
         } catch (thumbError) {
           console.warn('Thumbnail fallback also failed:', thumbError);
           updateStatus('thumbnailLarge', 'error');
           updateStatus('thumbnailSmall', 'error');
         }
      }

      // Complete
      updateProgress('Complete', 100, hasVideoExportError ? 'Export completed with limitations' : 'All files exported successfully!', true);

      // Success message
      setTimeout(() => {
        const basePrefix = `${exportSettings.category}_${exportSettings.templateNumber}_${exportSettings.musicId}_${cutMarkers.length + 1}_${Math.ceil(endTime - startTime)}s`;
        
        if (hasVideoExportError) {
          const successCount = 2 + (exportStatus.thumbnailLarge === 'success' ? 1 : 0) + (exportStatus.thumbnailSmall === 'success' ? 1 : 0);
          alert(`⚠️ Export Completed with Limitations!\n\n✅ ${successCount} files downloaded successfully:\n• ${basePrefix}_project.json\n• ${basePrefix}_music_trimmed_*.wav${exportStatus.thumbnailLarge === 'success' ? `\n• ${basePrefix}_thumbnail_large_*.jpeg` : ''}${exportStatus.thumbnailSmall === 'success' ? `\n• ${basePrefix}_thumbnail_small_*.jpeg` : ''}\n\n❌ Video export failed (FFmpeg not available in production)\n💡 Use the individual raw videos from the Pexels panel instead\n\n🚀 JSON and Audio are ready for Snapcut!`);
        } else {
          alert(`🎉 Export Complete!\n\n✅ All 6 files downloaded:\n• ${basePrefix}_project.json\n• ${basePrefix}_music_trimmed_*.wav\n• ${basePrefix}_render_HD.mp4 (720p)\n• ${basePrefix}_render_SD.mp4 (360p)\n• ${basePrefix}_thumbnail_large_*.jpeg\n• ${basePrefix}_thumbnail_small_*.jpeg\n\n🚀 Ready for Snapcut!`);
        }
      }, 1000);

    } catch (error) {
      console.error('Master export failed:', error);
      setError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        setExportProgress(null);
      }, 3000);
    }
  }, [canExport, cutMarkers, startTime, endTime, audioFile, videoAssignments, videoTrimSettings, exportSettings, generateSnapcutJSON, updateProgress, updateStatus]);

  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full bg-slate-400"></div>;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Complete Export</h2>
            <p className="text-sm text-slate-600">
              {exportProgress?.isComplete && exportProgress.message.includes('limitations') 
                ? 'Downloaded available files: JSON, Audio, Thumbnails (video export failed)'
                : 'Download all 6 files: JSON, Audio, 2 Videos, 2 Thumbnails'
              }
            </p>
          </div>
        </div>

        {/* Export Status Grid */}
        {isExporting && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                {getStatusIcon(exportStatus.json)}
                <span>Project JSON</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(exportStatus.audio)}
                <span>Audio Track</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(exportStatus.video720p)}
                <span>Video 720p</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(exportStatus.video360p)}
                <span>Video 360p</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(exportStatus.thumbnailLarge)}
                <span>Thumbnail Large</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(exportStatus.thumbnailSmall)}
                <span>Thumbnail Small</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {exportProgress && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-700">{exportProgress.step}</span>
              <span className="text-sm text-slate-500">{exportProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress.progress}%` }}
              ></div>
            </div>
            <div className="mt-1 text-xs text-slate-600">{exportProgress.message}</div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span><strong>Export Failed:</strong> {error}</span>
            </div>
          </div>
        )}

        {/* Export Button */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={exportAll}
            disabled={!canExport || isExporting}
            className="w-full max-w-md flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all text-lg"
          >
            {isExporting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download All (6 Files)
              </>
            )}
          </button>

          <div className="text-center text-sm text-slate-500 space-y-1">
            <p>Includes: JSON Template, Audio Track, Videos (720p + 360p), Thumbnails (Large + Small)</p>
            {(() => {
              const sabStatus = detectSharedArrayBuffer();
              if (!sabStatus.available) {
                return (
                  <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">⚠️ FFmpeg.js Limited: {sabStatus.reason}</span>
                    </div>
                    <button
                      onClick={() => {
                        logSharedArrayBufferDiagnostic();
                        alert(`SharedArrayBuffer Diagnostic:\n\n${sabStatus.reason}\n\nSuggestions:\n${sabStatus.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nCheck console for detailed diagnostic.`);
                      }}
                      className="text-amber-300 hover:text-amber-100 underline text-xs"
                    >
                      🔍 Run Diagnostic (check console)
                    </button>
                  </div>
                );
              }
              return null;
            })()}
            {!canExport && (
              <p className="text-red-500">
                {!audioFile ? 'Upload audio file first' : 
                 videoAssignments.size === 0 ? 'Assign videos to plans first' :
                 (endTime - startTime) > 30 ? 'Reduce duration to ≤ 30 seconds' :
                 (endTime - startTime) <= 0 ? 'Set valid audio trim points' :
                 'Ready to export!'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 