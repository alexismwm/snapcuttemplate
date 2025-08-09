import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Scissors, Square, RotateCcw, ChevronLeft, ChevronRight, CornerDownLeft, CornerDownRight, Shuffle } from 'lucide-react';
import { AudioFile, BeatMarker, CutMarker } from '../types';

interface WaveformVisualizerProps {
  audioFile: AudioFile;
  currentTime: number;
  isPlaying: boolean;
  beatMarkers: BeatMarker[];
  cutMarkers: CutMarker[];
  startTime: number;
  endTime: number;
  onBeatDetected: (beats: BeatMarker[]) => void;
  onAddCut: (time: number) => void;
  onRemoveCut: (id: string) => void;
  onMoveCut: (id: string, newTime: number) => void;
  onSeek: (time: number) => void;
  onTrimChange: (startTime: number, endTime: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onStop: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  onRandomMode: () => void;
}

const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#F59E0B'];

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  audioFile,
  currentTime,
  isPlaying,
  beatMarkers,
  cutMarkers,
  startTime,
  endTime,
  onBeatDetected,
  onAddCut,
  onRemoveCut,
  onMoveCut,
  onSeek,
  onTrimChange,
  zoom,
  onZoomChange,
  onStop,
  isLooping,
  onToggleLoop,
  onRandomMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cutAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState<{ type: 'trim-start' | 'trim-end' | 'cut', id?: string } | null>(null);
  const [viewOffset, setViewOffset] = useState(0);
  const [selectedTool, setSelectedTool] = useState<'in' | 'out' | null>(null);
  const [hasDragged, setHasDragged] = useState(false);

  useEffect(() => {
    const analyzeAudio = async () => {
      if (!audioFile.file) return;
      
      setIsAnalyzing(true);
      try {
        const audioContext = new AudioContext();
        const arrayBuffer = await audioFile.file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const samples = Math.min(12000, channelData.length);
        const blockSize = Math.floor(channelData.length / samples);
        const filteredData = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            const index = i * blockSize + j;
            if (index < channelData.length) {
              sum += Math.abs(channelData[index]);
            }
          }
          filteredData[i] = sum / blockSize;
        }

        setWaveformData(filteredData);

        // Beat detection
        const beats: BeatMarker[] = [];
        const threshold = 0.08;
        const minInterval = 0.15;
        
        const smoothed = new Float32Array(samples);
        for (let i = 2; i < samples - 2; i++) {
          smoothed[i] = (filteredData[i-2] + filteredData[i-1] + filteredData[i] + filteredData[i+1] + filteredData[i+2]) / 5;
        }
        
        for (let i = 3; i < smoothed.length - 3; i++) {
          const time = (i / samples) * audioFile.duration;
          const amplitude = smoothed[i];
          
          if (amplitude > threshold && 
              amplitude > smoothed[i - 1] && 
              amplitude > smoothed[i + 1] &&
              amplitude > smoothed[i - 2] && 
              amplitude > smoothed[i + 2]) {
            
            const lastBeat = beats[beats.length - 1];
            if (!lastBeat || time - lastBeat.time > minInterval) {
              beats.push({
                time,
                intensity: amplitude,
                type: amplitude > 0.25 ? 'strong' : amplitude > 0.15 ? 'medium' : 'weak'
              });
            }
          }
        }

        onBeatDetected(beats);
        audioContext.close();
      } catch (error) {
        console.error('Error analyzing audio:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeAudio();
  }, [audioFile, onBeatDetected]);

  // Calculate visible time range
  const getVisibleRange = useCallback(() => {
    const visibleDuration = audioFile.duration / zoom;
    const maxOffset = Math.max(0, audioFile.duration - visibleDuration);
    const clampedOffset = Math.max(0, Math.min(maxOffset, viewOffset));
    return {
      startTime: clampedOffset,
      endTime: clampedOffset + visibleDuration,
      duration: visibleDuration
    };
  }, [audioFile.duration, zoom, viewOffset]);

  // Auto-follow playhead when playing and zoomed
  useEffect(() => {
    if (isPlaying && zoom > 1) {
      const { startTime: visibleStart, endTime: visibleEnd } = getVisibleRange();
      const playheadBuffer = (visibleEnd - visibleStart) * 0.1; // 10% buffer
      
      if (currentTime < visibleStart + playheadBuffer || currentTime > visibleEnd - playheadBuffer) {
        const newOffset = Math.max(0, currentTime - (visibleEnd - visibleStart) / 2);
        const maxOffset = Math.max(0, audioFile.duration - (visibleEnd - visibleStart));
        setViewOffset(Math.min(maxOffset, newOffset));
      }
    }
  }, [currentTime, isPlaying, zoom, audioFile.duration, getVisibleRange]);
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual canvas size in memory (scaled up for retina)
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Scale the canvas back down using CSS
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // Scale the drawing context so everything draws at the correct size
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, height);
    
    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const { startTime: startOffset, endTime: endOffset } = getVisibleRange();
    
    const samples = waveformData.length;
    const startSample = Math.floor((startOffset / audioFile.duration) * samples);
    const endSample = Math.floor((endOffset / audioFile.duration) * samples);
    const visibleSamples = endSample - startSample;
    
    if (visibleSamples <= 0) return;

    const pixelsPerSample = width / visibleSamples;

    // Draw trim area background
    const trimStartX = Math.max(0, ((startTime - startOffset) / (endOffset - startOffset)) * width);
    const trimEndX = Math.min(width, ((endTime - startOffset) / (endOffset - startOffset)) * width);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, trimStartX, height);
    ctx.fillRect(trimEndX, 0, width - trimEndX, height);

    ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
    ctx.fillRect(trimStartX, 0, trimEndX - trimStartX, height);

    // Draw trim markers (thin lines)
    if (startTime >= startOffset && startTime <= endOffset) {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trimStartX, 0);
      ctx.lineTo(trimStartX, height);
      ctx.stroke();
      
      // IN label
      ctx.fillStyle = '#10B981';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 2;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('IN', trimStartX + 4, 15);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    if (endTime >= startOffset && endTime <= endOffset) {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trimEndX, 0);
      ctx.lineTo(trimEndX, height);
      ctx.stroke();
      
      // OUT label
      ctx.fillStyle = '#EF4444';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 2;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('OUT', trimEndX - 4, 15);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Draw waveform
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();

    const centerY = height / 2;
    ctx.moveTo(0, centerY);
    
    for (let i = 0; i < visibleSamples && (startSample + i) < samples; i++) {
      const x = i * pixelsPerSample;
      const amplitude = waveformData[startSample + i] || 0;
      const y = centerY - (amplitude * height * 0.4);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // Complete the waveform shape
    for (let i = visibleSamples - 1; i >= 0 && (startSample + i) < samples; i--) {
      const x = i * pixelsPerSample;
      const amplitude = waveformData[startSample + i] || 0;
      const y = centerY + (amplitude * height * 0.4);
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
    
    // Draw subtle center line
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw cut markers
    cutMarkers.forEach((cut, index) => {
      if (cut.time >= startOffset && cut.time <= endOffset) {
        const x = ((cut.time - startOffset) / (endOffset - startOffset)) * width;
        
        ctx.strokeStyle = cut.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Draw cut number with better visibility
        ctx.fillStyle = cut.color;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((index + 1).toString(), x, 20);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    });

    // Draw cut numbers and drag handles
    cutMarkers.forEach((cut, index) => {
      if (cut.time >= startOffset && cut.time <= endOffset) {
        const x = ((cut.time - startOffset) / (endOffset - startOffset)) * width;
        
        // Draw cut line
        ctx.strokeStyle = cut.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Draw cut number with better visibility
        ctx.fillStyle = cut.color;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((index + 1).toString(), x, 20);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw drag handle
        ctx.fillStyle = cut.color;
        ctx.fillRect(x - 6, height - 15, 12, 15);
      }
    });

    // Draw current time indicator
    if (currentTime >= startOffset && currentTime <= endOffset) {
      const currentX = ((currentTime - startOffset) / (endOffset - startOffset)) * width;
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(currentX, 0);
      ctx.lineTo(currentX, height);
      ctx.stroke();
    }

    // Draw trim handles (small rectangles at bottom)
    if (startTime >= startOffset && startTime <= endOffset) {
      ctx.fillStyle = isDragging?.type === 'trim-start' ? '#059669' : '#10B981';
      ctx.fillRect(trimStartX - 6, height - 12, 12, 12);
    }

    if (endTime >= startOffset && endTime <= endOffset) {
      ctx.fillStyle = isDragging?.type === 'trim-end' ? '#DC2626' : '#EF4444';
      ctx.fillRect(trimEndX - 6, height - 12, 12, 12);
    }

  }, [waveformData, cutMarkers, currentTime, audioFile.duration, startTime, endTime, getVisibleRange, isDragging]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    // If we just finished dragging, don't process the click
    if (hasDragged) {
      setHasDragged(false);
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    const { startTime: startOffset, endTime: endOffset } = getVisibleRange();
    
    const time = startOffset + (x / rect.width) * (endOffset - startOffset);
    
    // Check if clicking near trim handles (start drag)
    const trimStartX = Math.max(0, ((startTime - startOffset) / (endOffset - startOffset)) * rect.width);
    const trimEndX = Math.min(rect.width, ((endTime - startOffset) / (endOffset - startOffset)) * rect.width);
    
    if (Math.abs(x - trimStartX) < 12 && event.clientY > rect.height - 20) {
      setIsDragging({ type: 'trim-start' });
      setHasDragged(false);
      return;
    }
    if (Math.abs(x - trimEndX) < 12 && event.clientY > rect.height - 20) {
      setIsDragging({ type: 'trim-end' });
      setHasDragged(false);
      return;
    }
    
    // Check if clicking on cut handles (start drag)
    const clickedCut = cutMarkers.find(cut => {
      if (cut.time >= startOffset && cut.time <= endOffset) {
        const cutX = ((cut.time - startOffset) / (endOffset - startOffset)) * rect.width;
        return Math.abs(x - cutX) < 12 && event.clientY > rect.height - 20;
      }
      return false;
    });

    if (clickedCut) {
      setIsDragging({ type: 'cut', id: clickedCut.id });
      setHasDragged(false);
      return;
    }

    // Handle tool selection
    if (selectedTool === 'in') {
      onTrimChange(time, endTime);
      setSelectedTool(null);
      return;
    }
    if (selectedTool === 'out') {
      onTrimChange(startTime, time);
      setSelectedTool(null);
      return;
    }

    // Default: seek
    onSeek(Math.max(0, Math.min(audioFile.duration, time)));
  }, [audioFile.duration, startTime, endTime, onSeek, onTrimChange, getVisibleRange, cutMarkers, hasDragged, selectedTool]);

  const handleCutAreaClick = useCallback((event: React.MouseEvent) => {
    // If we just finished dragging, don't process the click
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    const rect = cutAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    
    const { startTime: startOffset, endTime: endOffset } = getVisibleRange();
    
    const time = startOffset + (x / rect.width) * (endOffset - startOffset);
    
    // Check if double-clicking on existing cut
    const clickedCut = cutMarkers.find(cut => {
      const cutX = ((cut.time - startOffset) / (endOffset - startOffset)) * rect.width;
      return Math.abs(x - cutX) < 10;
    });

    if (event.detail === 2 && clickedCut) {
      // Double click - remove cut
      onRemoveCut(clickedCut.id);
    } else if (event.detail === 1 && !clickedCut) {
      // Single click - add cut
      const snapDistance = 0.1;
      const nearestBeat = beatMarkers.find(beat => Math.abs(beat.time - time) < snapDistance);
      const snapTime = nearestBeat ? nearestBeat.time : time;
      onAddCut(Math.max(0, Math.min(audioFile.duration, snapTime)));
    }
  }, [audioFile.duration, beatMarkers, cutMarkers, onAddCut, onRemoveCut, getVisibleRange, hasDragged]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    // Mark that we're actively dragging
    if (!hasDragged) {
      setHasDragged(true);
    }
    
    const { startTime: startOffset, endTime: endOffset } = getVisibleRange();
    
    const time = Math.max(0, Math.min(audioFile.duration, startOffset + (x / rect.width) * (endOffset - startOffset)));

    if (isDragging.type === 'trim-start' && time < endTime) {
      onTrimChange(time, endTime);
    } else if (isDragging.type === 'trim-end' && time > startTime) {
      onTrimChange(startTime, time);
    } else if (isDragging.type === 'cut' && isDragging.id) {
      onMoveCut(isDragging.id, time);
    }
  }, [isDragging, hasDragged, audioFile.duration, startTime, endTime, onTrimChange, onMoveCut, getVisibleRange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Add mouse leave handler to ensure drag state is reset
  const handleMouseLeave = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Handle mouse wheel for horizontal scrolling
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.ctrlKey || event.metaKey) {
      // Zoom with Ctrl/Cmd + scroll
      const zoomDelta = event.deltaY > 0 ? -0.5 : 0.5;
      const newZoom = Math.max(0.5, Math.min(10, zoom + zoomDelta));
      onZoomChange(newZoom);
    } else {
      // Horizontal scroll
      const scrollDelta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
      const { duration } = getVisibleRange();
      const scrollSpeed = duration * 0.05;
      const newOffset = viewOffset + (scrollDelta > 0 ? scrollSpeed : -scrollSpeed);
      const maxOffset = Math.max(0, audioFile.duration - duration);
      setViewOffset(Math.max(0, Math.min(maxOffset, newOffset)));
    }
  }, [viewOffset, audioFile.duration, getVisibleRange, zoom, onZoomChange]);

  const handleLiveCut = useCallback(() => {
    onAddCut(currentTime);
  }, [currentTime, onAddCut]);

  const handleSetIn = useCallback(() => {
    onTrimChange(currentTime, endTime);
  }, [currentTime, endTime, onTrimChange]);

  const handleSetOut = useCallback(() => {
    onTrimChange(startTime, currentTime);
  }, [startTime, currentTime, onTrimChange]);

  const navigateTimeline = useCallback((direction: 'left' | 'right') => {
    const { duration } = getVisibleRange();
    const step = duration * 0.1;
    const newOffset = viewOffset + (direction === 'right' ? step : -step);
    const maxOffset = Math.max(0, audioFile.duration - duration);
    setViewOffset(Math.max(0, Math.min(maxOffset, newOffset)));
  }, [viewOffset, audioFile.duration, getVisibleRange]);

  return (
    <div className="space-y-4 p-6">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigateTimeline('left')}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => navigateTimeline('right')}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-slate-600"></div>
          
          <button
            onClick={handleSetIn}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <CornerDownLeft className="w-4 h-4" />
            <span>Set IN</span>
          </button>
          
          <button
            onClick={handleSetOut}
            className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <CornerDownRight className="w-4 h-4" />
            <span>Set OUT</span>
          </button>
          
          <button
            onClick={onRandomMode}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Shuffle className="w-4 h-4" />
            <span>Random</span>
          </button>
          
          <div className="w-px h-6 bg-slate-600"></div>
          
          <button
            onClick={handleLiveCut}
            className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Scissors className="w-4 h-4" />
            <span>Cut Here</span>
          </button>
          
          <div className="w-px h-6 bg-slate-600"></div>
          
          <button
            onClick={onStop}
            className="flex items-center space-x-2 bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Square className="w-4 h-4" />
            <span>Stop</span>
          </button>
          
          <button
            onClick={onToggleLoop}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              isLooping 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-slate-600 hover:bg-slate-500'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Loop</span>
          </button>
        </div>
          
        <div className="flex items-center space-x-3">
          <div className="w-px h-6 bg-slate-600"></div>
          
          <button
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.5))}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-400 min-w-[60px] text-center font-mono">{zoom.toFixed(1)}x</span>
          <button
            onClick={() => onZoomChange(Math.min(10, zoom + 0.5))}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <kbd className="bg-slate-600 px-2 py-1 rounded text-xs font-mono">Space</kbd>
            <span>Play/Pause</span>
          </div>
          <div className="flex items-center space-x-2">
            <kbd className="bg-slate-600 px-2 py-1 rounded text-xs font-mono">C</kbd>
            <span>Add Cut</span>
          </div>
          <div className="flex items-center space-x-2">
            <kbd className="bg-slate-600 px-2 py-1 rounded text-xs font-mono">I</kbd>
            <span>Set IN</span>
          </div>
          <div className="flex items-center space-x-2">
            <kbd className="bg-slate-600 px-2 py-1 rounded text-xs font-mono">O</kbd>
            <span>Set OUT</span>
          </div>
          <div className="flex items-center space-x-2">
            <kbd className="bg-slate-600 px-2 py-1 rounded text-xs font-mono">←/→</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center space-x-2">
            <kbd className="bg-slate-600 px-2 py-1 rounded text-xs font-mono">Scroll</kbd>
            <span>Move Timeline</span>
          </div>
          <div className="flex items-center space-x-2">
            <kbd className="bg-slate-600 px-2 py-1 rounded text-xs font-mono">Ctrl+Scroll</kbd>
            <span>Zoom</span>
          </div>
          <div className="flex items-center space-x-2">
            <kbd className="bg-slate-600 px-2 py-1 rounded text-xs font-mono">L</kbd>
            <span>Toggle Loop</span>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden shadow-lg"
        onWheel={handleWheel}
      >
        {isAnalyzing && (
          <div className="p-4 flex items-center justify-center space-x-2 text-blue-400">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Analyzing beats...</span>
          </div>
        )}

        {/* Cut area */}
        <div 
          ref={cutAreaRef}
          className={`h-10 bg-slate-700/50 border-b border-slate-600/50 relative ${
            selectedTool ? 'cursor-crosshair' : 'cursor-pointer'
          }`}
          onClick={handleCutAreaClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-medium">
            {selectedTool ? `Click to set ${selectedTool.toUpperCase()} point` : 'Click to add cuts • Drag handles at bottom to move'}
          </div>
        </div>

        {/* Waveform */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            className={`w-full h-56 block ${
              selectedTool ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-pointer'
            }`}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ imageRendering: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
};