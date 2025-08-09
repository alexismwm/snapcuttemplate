import React, { useState } from 'react';
import { Download, FileText, Music, Settings, Scissors, Play, Users } from 'lucide-react';
import { AudioFile, CutMarker, SnapcutExport } from '../types';
import { VideoAsset } from '../types/video';
import { trimAudioFile, downloadAudioBlob } from '../utils/audioTrimmer';
import { FileNamingService, ProjectSettings, NamingContext } from '../services/fileNamingService';

interface ExportPanelProps {
  audioFile: AudioFile;
  cutMarkers: CutMarker[];
  startTime: number;
  endTime: number;
  videoAssignments?: Map<number, VideoAsset>;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  audioFile,
  cutMarkers,
  startTime,
  endTime,
  videoAssignments = new Map()
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    category: 'Travel',
    templateNumber: '006',
    musicId: '012'
  });

  const generateFileName = (type: 'music' | 'project') => {
    const namingContext = FileNamingService.createContext(
      exportSettings,
      cutMarkers,
      endTime - startTime
    );

    if (type === 'music') {
      return FileNamingService.generateMusicFilename(namingContext).replace('.wav', '');
    } else {
      return FileNamingService.generateProjectFilename(namingContext).replace('.json', '');
    }
  };

  const generateSnapcutJSON = (): SnapcutExport => {
    const now = Date.now() / 1000;
    const trimmedDuration = endTime - startTime;
    
    // Générer le nom de fichier audio exporté avec le service de naming unifié
    const namingContext = FileNamingService.createContext(
      exportSettings,
      cutMarkers,
      endTime - startTime
    );
    const audioFileName = FileNamingService.generateMusicFilename(namingContext, startTime, endTime);
    
    // Create video placeholder segments based on cut markers (indépendant des vidéos Pexels)
    const createVideoPlaceholderSegments = () => {
      const segments: Array<{ planIndex: number; video: VideoAsset | null; startTime: number; endTime: number }> = [];
      
      // Calculate time segments
      const sortedCuts = [...cutMarkers].sort((a, b) => a.time - b.time);
      
      // First segment (Plan 1) - TOUJOURS inclus même sans vidéo assignée
      const firstCutTime = sortedCuts.length > 0 ? sortedCuts[0].time : endTime;
      segments.push({
        planIndex: 1,
        video: videoAssignments?.get(1) || null, // Vidéo Pexels ou null pour placeholder
        startTime: startTime,
        endTime: Math.min(firstCutTime, endTime)
      });
      
      // Subsequent segments (Plans 2, 3, 4...)
      for (let i = 0; i < sortedCuts.length; i++) {
        const cut = sortedCuts[i];
        const nextCut = sortedCuts[i + 1];
        const planIndex = i + 2;
        
        if (cut.time < endTime) {
          segments.push({
            planIndex,
            video: videoAssignments?.get(planIndex) || null, // Vidéo Pexels ou null pour placeholder
            startTime: Math.max(cut.time, startTime),
            endTime: Math.min(nextCut ? nextCut.time : endTime, endTime)
          });
        }
      }
      
      return segments.filter(segment => segment.endTime > segment.startTime);
    };
    
    const videoSegments = createVideoPlaceholderSegments();
    
    // Generate main timeline avec le format exact du JSON qui marche
    const mainTimeline = videoSegments.map((segment, index) => {
      const segmentDuration = segment.endTime - segment.startTime;
      
      // Couleurs distinctes pour chaque plan (comme dans l'exemple qui marche)
      const planColors = [
        [0.75, 0.75, 0.75, 1],  // Plan 1: Gris clair
        [0.33333334, 0, 0, 1],  // Plan 2: Rouge foncé
        [1, 0.932, 0.32, 1],    // Plan 3: Jaune
        [0, 0.5, 1, 1],         // Plan 4: Bleu
        [0.5, 1, 0, 1],         // Plan 5: Vert
        [1, 0, 1, 1],           // Plan 6: Magenta
        [1, 0.5, 0, 1],         // Plan 7: Orange
        [0.5, 0, 1, 1]          // Plan 8: Violet
      ];
      
      const planColor = planColors[index % planColors.length];
      
      return {
        scale: [1, 1.777, 1] as [number, number, number],
        backgroundBlurEnabled: false,
        animationStartScale: [1, 1.777, 1] as [number, number, number],
        blend: {
          none: {}
        },
        colorAdjustment: {
          sharpness: 0,
          exposure: 0,
          temperature: 0,
          contrast: 1,
          saturation: 1,
          hue: 0
        },
        contentRotation: 0,
        aspect: {
          aspectFill: {}
        },
        animationStartRotation: [0, 0, 0] as [number, number, number],
        backgroundColor: [0, 0, 0, 1] as [number, number, number, number],
        isAnimated: false,
        animationEndScale: [1, 1.777, 1] as [number, number, number],
        position: [0, 0] as [number, number],
        animationEndPosition: [0, 0] as [number, number],
        kind: {
          empty: {}
        },
        animationEndRotation: [0, 0, 0] as [number, number, number],
        color: planColor as [number, number, number, number],
        animationStartPosition: [0, 0] as [number, number],
        opacity: 1,
        name: `Plan ${segment.planIndex}`,
        rotation: [0, 0, 0] as [number, number, number],
        duration: segmentDuration
      };
    });
    
    // Pas d'overlays pour les templates - superposition timeline vide
    const superpositionTimeline: any[] = [];

    return {
      id: crypto.randomUUID().toUpperCase(),
      title: generateFileName('project'),
      lastModificationDate: now,
      editionProject: {
        mainTimeline,
        aspectRatio: {
          r_9_16: {}
        },
        superpositionTimeline,
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
  };



  const handleExportJSON = async () => {
    setIsExporting(true);
    
    try {
      const snapcutData = generateSnapcutJSON();
      const jsonBlob = new Blob([JSON.stringify(snapcutData, null, 2)], { 
        type: 'application/json' 
      });

      const namingContext = FileNamingService.createContext(
        exportSettings,
        cutMarkers,
        endTime - startTime
      );
      const filename = FileNamingService.generateProjectFilename(namingContext);
      
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAudio = async () => {
    setIsExporting(true);
    
    try {
      console.log(`🎵 Trimming audio: ${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s`);
      
      // Trimmer l'audio selon les points IN et OUT
      const trimmedAudioBlob = await trimAudioFile(audioFile.file, {
        startTime,
        endTime,
        originalFileName: audioFile.name
      });
      
      // Générer le nom de fichier avec le service de naming unifié
      const namingContext = FileNamingService.createContext(
        exportSettings,
        cutMarkers,
        endTime - startTime
      );
      const trimmedFileName = FileNamingService.generateMusicFilename(namingContext, startTime, endTime);
      
      // Télécharger l'audio trimé
      downloadAudioBlob(trimmedAudioBlob, trimmedFileName);
      
      console.log(`✅ Audio exporté: ${trimmedFileName}`);
      
    } catch (error) {
      console.error('Audio trimming failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Audio export failed: ${errorMessage}\n\nPlease check that your IN/OUT points are valid and try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Export Settings</h3>
            <p className="text-xs text-slate-400">Configure your project export</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Category
              </label>
              <input
                type="text"
                value={exportSettings.category}
                onChange={(e) => setExportSettings(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none transition-colors"
                placeholder="Travel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Template #
              </label>
              <input
                type="text"
                value={exportSettings.templateNumber}
                onChange={(e) => setExportSettings(prev => ({ ...prev, templateNumber: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none transition-colors"
                placeholder="006"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Music ID
              </label>
              <input
                type="text"
                value={exportSettings.musicId}
                onChange={(e) => setExportSettings(prev => ({ ...prev, musicId: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none transition-colors"
                placeholder="012"
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-5 border border-slate-600/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-slate-300 font-medium">Preview Filenames</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                  <FileText className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-mono text-blue-200 truncate">{generateFileName('project')}.json</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                  <Music className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-mono text-orange-200 truncate">{generateFileName('music')}.wav</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-5 border border-slate-600/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                <Scissors className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-slate-300 font-medium">Trim Settings</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-green-300 text-xs font-medium mb-1">IN Point</div>
                <div className="text-white font-mono text-lg">{formatTime(startTime)}</div>
              </div>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="text-red-300 text-xs font-medium mb-1">OUT Point</div>
                <div className="text-white font-mono text-lg">{formatTime(endTime)}</div>
              </div>
            </div>
            {startTime >= endTime && (
              <div className="mt-4 text-amber-200 text-xs bg-amber-500/10 rounded-lg p-3 border border-amber-500/20 flex items-center gap-2">
                <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">!</span>
                </div>
                <span>Invalid trim points: OUT must be after IN</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Duration Card */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-purple-600/20 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative p-5 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="text-blue-200 text-sm font-medium mb-1">Duration</div>
                <div className="text-white font-bold text-2xl tracking-wide">
                  {Math.ceil(endTime - startTime)}<span className="text-blue-300 text-lg ml-1">s</span>
                </div>
              </div>
            </div>

            {/* Plans Card */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-teal-600/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative p-5 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="text-emerald-200 text-sm font-medium mb-1">Plans</div>
                <div className="text-white font-bold text-2xl tracking-wide">
                  {cutMarkers.length + 1}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleExportJSON}
          disabled={isExporting || cutMarkers.length === 0}
          className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed px-6 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none font-semibold"
        >
          {isExporting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileText className="w-5 h-5" />
          )}
          <span>Export Snapcut Project</span>
        </button>

        <button
          onClick={handleExportAudio}
          disabled={isExporting || startTime >= endTime}
          className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed px-6 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none font-semibold"
        >
          {isExporting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Scissors className="w-5 h-5" />
          )}
          <span>Export Trimmed Audio</span>
        </button>
      </div>

      {cutMarkers.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-sm bg-slate-700/20 rounded-xl border border-slate-600/30">
          <div className="text-2xl mb-2">✂️</div>
          <p className="font-medium">Add some cuts to enable JSON export</p>
        </div>
      )}

      {startTime >= endTime && (
        <div className="text-center py-6 text-amber-400 text-sm bg-amber-500/10 rounded-xl border border-amber-500/20">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="font-medium">Set valid IN/OUT points to enable audio export</p>
          <p className="text-xs mt-2 opacity-75">Use I and O keys or Set IN/OUT buttons</p>
        </div>
      )}
    </div>
  );
};