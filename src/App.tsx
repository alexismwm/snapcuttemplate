import React, { useState, useCallback, useEffect } from 'react';
import { Headphones, Zap, Music, Upload } from 'lucide-react';
import { AudioUploader } from './components/AudioUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { PreviewPanel } from './components/PreviewPanel';
import { ExportPanel } from './components/ExportPanel';
import { RandomModeDialog } from './components/RandomModeDialog';
import { ThemeSelector } from './components/ThemeSelector';
import { VideoDebug } from './components/VideoDebug';

import { MasterExportPanel } from './components/MasterExportPanel';
import { PexelsVideoManager } from './components/PexelsVideoManager';
import { generateRandomCuts } from './utils/randomCutGenerator';
import { AudioFile, BeatMarker, CutMarker, TimelineState } from './types';
import { VideoTheme, VideoAsset } from './types/video';
import { videoService } from './services/videoService';
import { planVideoAssigner } from './services/planVideoAssigner';

const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#F59E0B'];

function App() {
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [beatMarkers, setBeatMarkers] = useState<BeatMarker[]>([]);
  const [cutMarkers, setCutMarkers] = useState<CutMarker[]>([]);
  const [timelineState, setTimelineState] = useState<TimelineState>({
    currentTime: 0,
    isPlaying: false,
    zoom: 1,
    startTime: 0,
    endTime: 0
  });
  const [isLooping, setIsLooping] = useState(false);
  const [isRandomModeOpen, setIsRandomModeOpen] = useState(false);
  
  // Video system states
  const [currentTheme, setCurrentTheme] = useState<VideoTheme>('Travel');
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videoAssignments, setVideoAssignments] = useState<Map<number, VideoAsset>>(new Map());
  const [videoTrimSettings, setVideoTrimSettings] = useState<Map<number, { startTime: number; endTime: number }>>(new Map());

  const handleAudioLoad = useCallback((file: AudioFile) => {
    setIsLoading(true);
    setAudioFile(file);
    setTimelineState(prev => ({
      ...prev,
      startTime: 0,
      endTime: file.duration,
      currentTime: 0,
      isPlaying: false,
      zoom: 1
    }));
    setCutMarkers([]);
    setBeatMarkers([]);
    setIsLoading(false);
  }, []);

  const handleBeatDetected = useCallback((beats: BeatMarker[]) => {
    setBeatMarkers(beats);
  }, []);

  const handleAddCut = useCallback((time: number) => {
    if (!audioFile) return;

    const nextCut = cutMarkers.find(cut => cut.time > time);
    const defaultDuration = nextCut ? Math.min(nextCut.time - time, 1) : 1;

    const newCut: CutMarker = {
      id: crypto.randomUUID(),
      time,
      color: COLORS[cutMarkers.length % COLORS.length],
      duration: defaultDuration
    };

    setCutMarkers(prev => [...prev, newCut].sort((a, b) => a.time - b.time));
  }, [audioFile, cutMarkers]);

  const handleRemoveCut = useCallback((id: string) => {
    setCutMarkers(prev => prev.filter(cut => cut.id !== id));
  }, []);

  const handleMoveCut = useCallback((id: string, newTime: number) => {
    setCutMarkers(prev => prev.map(cut => 
      cut.id === id ? { ...cut, time: newTime } : cut
    ).sort((a, b) => a.time - b.time));
  }, []);

  const handleSeek = useCallback((time: number) => {
    setTimelineState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const handlePlayPause = useCallback(() => {
    setTimelineState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const handleStop = useCallback(() => {
    setTimelineState(prev => ({ 
      ...prev, 
      isPlaying: false, 
      currentTime: prev.startTime 
    }));
  }, []);

  const handleToggleLoop = useCallback(() => {
    setIsLooping(prev => !prev);
  }, []);

  const handleTrimChange = useCallback((start: number, end: number) => {
    setTimelineState(prev => ({
      ...prev,
      startTime: start,
      endTime: end
    }));
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setTimelineState(prev => ({ ...prev, zoom }));
  }, []);

  const handleRandomMode = useCallback(() => {
    setIsRandomModeOpen(true);
  }, []);

  const handleRandomModeClose = useCallback(() => {
    setIsRandomModeOpen(false);
  }, []);

  const handleGenerateRandomCuts = useCallback((planCount: number) => {
    if (!audioFile || beatMarkers.length === 0) return;

    const newCuts = generateRandomCuts({
      startTime: timelineState.startTime,
      endTime: timelineState.endTime,
      planCount,
      beatMarkers,
      minCutInterval: 0.8,
      prioritizeStrongBeats: true
    });

    setCutMarkers(newCuts);
    setIsRandomModeOpen(false);
  }, [audioFile, beatMarkers, timelineState.startTime, timelineState.endTime]);

  // Video system handlers
  const handleThemeChange = useCallback(async (theme: VideoTheme, customKeywords?: string[]) => {
    setCurrentTheme(theme);
    setIsLoadingVideos(true);
    
    try {
      // TOUJOURS forcer le refresh pour éviter les problèmes de cache
      await videoService.getVideosByTheme(theme, true, customKeywords); // Force refresh = true
      const newAssignments = await planVideoAssigner.assignVideosToPlans(
        cutMarkers,
        theme,
        true, // Force reassign for new theme
        customKeywords
      );
      setVideoAssignments(newAssignments);
      
      const keywordInfo = customKeywords && customKeywords.length > 0 
        ? ` with keywords: [${customKeywords.join(', ')}]` 
        : '';
      console.log(`🎬 Theme changed to "${theme}"${keywordInfo} - CACHE CLEARED`);
    } catch (error) {
      console.error('Failed to load videos for theme:', error);
    } finally {
      setIsLoadingVideos(false);
    }
  }, [cutMarkers]);

  const handleVideoAssignmentsChange = useCallback((assignments: Map<number, VideoAsset>) => {
    setVideoAssignments(assignments);
  }, []);

  const handleVideoTrimChange = useCallback((planIndex: number, startTime: number, endTime: number) => {
    setVideoTrimSettings(prev => {
      const newSettings = new Map(prev);
      newSettings.set(planIndex, { startTime, endTime });
      return newSettings;
    });
    console.log(`🎬 Video trim updated for Plan ${planIndex}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);
  }, []);

  // Preload popular video themes when audio is loaded
  useEffect(() => {
    if (audioFile) {
      videoService.preloadPopularThemes().catch(error => 
        console.warn('Failed to preload video themes:', error)
      );
    }
  }, [audioFile]);

  // Handle looping
  useEffect(() => {
    if (timelineState.currentTime < timelineState.startTime) {
      setTimelineState(prev => ({ 
        ...prev, 
        currentTime: prev.startTime 
      }));
    }
  }, [timelineState.currentTime, timelineState.startTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!audioFile) return;

      // Désactiver les raccourcis si l'utilisateur est dans un champ de saisie
      const activeElement = document.activeElement;
      const isInputField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
      
      if (isInputField) return; // Ne pas traiter les raccourcis dans les champs de saisie

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'KeyC':
          e.preventDefault();
          handleAddCut(timelineState.currentTime);
          break;
        case 'KeyI':
          e.preventDefault();
          setTimelineState(prev => ({ ...prev, startTime: prev.currentTime }));
          break;
        case 'KeyO':
          e.preventDefault();
          setTimelineState(prev => ({ ...prev, endTime: prev.currentTime }));
          break;
        case 'KeyL':
          e.preventDefault();
          handleToggleLoop();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSeek(Math.max(0, timelineState.currentTime - 0.1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSeek(Math.min(audioFile.duration, timelineState.currentTime + 0.1));
          break;
        case 'KeyR':
          e.preventDefault();
          handleRandomMode();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [audioFile, timelineState, handlePlayPause, handleAddCut, handleSeek, handleToggleLoop]);

  const handleNewProject = () => {
    setAudioFile(null);
    setCutMarkers([]);
    setBeatMarkers([]);
    setTimelineState({
      currentTime: 0,
      isPlaying: false,
      zoom: 1,
      startTime: 0,
      endTime: 0
    });
    setIsLooping(false);
    setIsRandomModeOpen(false);
    // Reset video system
    setCurrentTheme('Travel');
    setIsLoadingVideos(false);
    setVideoTrimSettings(new Map());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Snapcut Beat Editor</h1>
                <p className="text-xs text-slate-400">Create beat-synced video templates</p>
              </div>
            </div>
            
            {audioFile && (
              <button
                onClick={handleNewProject}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium text-white"
              >
                <Upload className="w-4 h-4" />
                <span>New Project</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {!audioFile ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] pb-8">
          <div className="w-full max-w-2xl mx-auto px-4">
            <AudioUploader onAudioLoad={handleAudioLoad} isLoading={isLoading} />
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Main Content */}
          <div className="grid grid-cols-1 2xl:grid-cols-4 gap-6">
            {/* Timeline Section - Takes most space */}
            <div className="2xl:col-span-3 space-y-6">
              {/* Audio Controls */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <Music className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white truncate">{audioFile.name}</h2>
                      <p className="text-sm text-slate-400">
                        {Math.floor(audioFile.duration / 60)}:{Math.floor(audioFile.duration % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <AudioPlayer
                      audioFile={audioFile}
                      currentTime={timelineState.currentTime}
                      isPlaying={timelineState.isPlaying}
                      onTimeUpdate={handleSeek}
                      onPlayPause={handlePlayPause}
                      startTime={timelineState.startTime}
                      endTime={timelineState.endTime}
                      isLooping={isLooping}
                    />
                  </div>
                </div>
              </div>

              {/* Waveform */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
                <WaveformVisualizer
                  audioFile={audioFile}
                  currentTime={timelineState.currentTime}
                  isPlaying={timelineState.isPlaying}
                  beatMarkers={beatMarkers}
                  cutMarkers={cutMarkers}
                  startTime={timelineState.startTime}
                  endTime={timelineState.endTime}
                  onBeatDetected={handleBeatDetected}
                  onAddCut={handleAddCut}
                  onRemoveCut={handleRemoveCut}
                  onMoveCut={handleMoveCut}
                  onSeek={handleSeek}
                  onTrimChange={handleTrimChange}
                  zoom={timelineState.zoom}
                  onZoomChange={handleZoomChange}
                  onStop={handleStop}
                  isLooping={isLooping}
                  onToggleLoop={handleToggleLoop}
                  onRandomMode={handleRandomMode}
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="2xl:col-span-1 space-y-6">
              {/* Preview */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 shadow-xl">
                <PreviewPanel 
                  cutMarkers={cutMarkers}
                  currentTime={timelineState.currentTime}
                  currentTheme={currentTheme}
                  startTime={timelineState.startTime}
                  endTime={timelineState.endTime}
                  videoAssignments={videoAssignments}
                  onVideoAssignmentsChange={handleVideoAssignmentsChange}
                  audioDuration={audioFile?.duration || 0}
                  onVideoTrimChange={handleVideoTrimChange}
                  videoTrimSettings={videoTrimSettings}
                />
              </div>

              {/* Pexels Video Manager */}
              <PexelsVideoManager
                cutMarkers={cutMarkers}
                startTime={timelineState.startTime}
                endTime={timelineState.endTime}
                onVideoAssignmentsChange={handleVideoAssignmentsChange}
              />

              {/* Export Panel */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 shadow-xl">
                <ExportPanel
                  audioFile={audioFile}
                  cutMarkers={cutMarkers}
                  startTime={timelineState.startTime}
                  endTime={timelineState.endTime}
                  videoAssignments={videoAssignments}
                />
              </div>



            </div>
          </div>

          {/* Master Export Panel - Clean UI at the bottom */}
          {audioFile && (
            <div className="mt-8">
              <MasterExportPanel
                audioFile={audioFile}
                cutMarkers={cutMarkers}
                startTime={timelineState.startTime}
                endTime={timelineState.endTime}
                videoAssignments={videoAssignments}
                videoTrimSettings={videoTrimSettings}
              />
            </div>
          )}

        </div>
      )}

      {/* Random Mode Dialog */}
      <RandomModeDialog
        isOpen={isRandomModeOpen}
        onClose={handleRandomModeClose}
        onGenerate={handleGenerateRandomCuts}
        hasInOutPoints={timelineState.startTime < timelineState.endTime && timelineState.endTime > timelineState.startTime + 1}
        startTime={timelineState.startTime}
        endTime={timelineState.endTime}
        duration={audioFile?.duration || 0}
        existingCutsCount={cutMarkers.length}
      />

      {/* Video Debug Panel (development only) */}
      <VideoDebug />
    </div>
  );
}

export default App;