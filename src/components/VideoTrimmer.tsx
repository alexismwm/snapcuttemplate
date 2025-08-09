import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Scissors, ChevronLeft, ChevronRight } from 'lucide-react';
import { VideoAsset } from '../types/video';

interface VideoTrimmerProps {
  video: VideoAsset;
  planIndex: number;
  audioDuration: number;
  planDuration: number; // Durée exacte requise pour ce plan
  onTrimChange: (planIndex: number, startTime: number, endTime: number) => void;
  onClose: () => void;
}

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  video,
  planIndex,
  audioDuration,
  planDuration,
  onTrimChange,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // Use fixed zone approach - zone duration = plan duration
  const fixedZoneDuration = planDuration;
  const [zoneStartTime, setZoneStartTime] = useState(0); // Where the fixed zone starts
  
  // Calculate derived values
  const startTime = zoneStartTime;
  const endTime = Math.min(zoneStartTime + fixedZoneDuration, video.duration);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);

  // Load video metadata
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleLoadedMetadata = () => {
      setIsVideoLoaded(true);
      // Initialize zone at the beginning, but ensure it doesn't exceed video duration
      const maxZoneStart = Math.max(0, videoElement.duration - fixedZoneDuration);
      setZoneStartTime(Math.min(0, maxZoneStart));
    };

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (videoElement.currentTime >= endTime) {
        videoElement.currentTime = startTime;
        setCurrentTime(startTime);
      }
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('ended', handleEnded);

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('ended', handleEnded);
    };
  }, [audioDuration, endTime, startTime]);

  // Control video playback within trim bounds
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !isVideoLoaded) return;

    if (currentTime >= endTime && isPlaying) {
      videoElement.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [currentTime, endTime, startTime, isPlaying, isVideoLoaded]);

  const handlePlayPause = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.pause();
    } else {
      if (currentTime >= endTime) {
        videoElement.currentTime = startTime;
      }
      videoElement.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, currentTime, endTime, startTime]);

  const handleSeek = useCallback((time: number) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const clampedTime = Math.max(startTime, Math.min(endTime, time));
    videoElement.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [startTime, endTime]);

  const handleZoneMove = useCallback((newStartTime: number) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Ensure zone doesn't go out of bounds
    const maxZoneStart = Math.max(0, videoElement.duration - fixedZoneDuration);
    const clampedStart = Math.max(0, Math.min(newStartTime, maxZoneStart));
    
    setZoneStartTime(clampedStart);
    
    // Update current time if it's outside the new zone
    const newEndTime = clampedStart + fixedZoneDuration;
    if (currentTime < clampedStart || currentTime > newEndTime) {
      const newCurrentTime = clampedStart + (fixedZoneDuration / 2); // Center of zone
      videoElement.currentTime = newCurrentTime;
      setCurrentTime(newCurrentTime);
    }
  }, [fixedZoneDuration, currentTime]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || !isVideoLoaded || !videoRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const clickTime = percentage * videoRef.current.duration;
    
    handleSeek(clickTime);
  }, [isVideoLoaded, handleSeek]);

  const handleMouseDown = useCallback(() => {
    setIsDragging('start'); // We only move the whole zone now
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !timelineRef.current || !videoRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const moveX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, moveX / rect.width));
    const newTime = percentage * videoRef.current.duration;

    handleZoneMove(newTime);
  }, [isDragging, handleZoneMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  const handleApplyTrim = useCallback(() => {
    onTrimChange(planIndex, startTime, endTime);
    onClose();
  }, [planIndex, startTime, endTime, onTrimChange, onClose]);

  const handleReset = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Reset zone to beginning
    setZoneStartTime(0);
    setCurrentTime(0);
    videoElement.currentTime = 0;
  }, []);

  const handleCloseTrimmer = useCallback(() => {
    // Auto-save before closing
    onTrimChange(planIndex, startTime, endTime);
    onClose();
  }, [planIndex, startTime, endTime, onTrimChange, onClose]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const trimmedDuration = endTime - startTime;
  const videoProgress = isVideoLoaded && videoRef.current 
    ? (currentTime / videoRef.current.duration) * 100 
    : 0;
  const startPercent = isVideoLoaded && videoRef.current 
    ? (startTime / videoRef.current.duration) * 100 
    : 0;
  const endPercent = isVideoLoaded && videoRef.current 
    ? (endTime / videoRef.current.duration) * 100 
    : 100;
  const zoneWidthPercent = isVideoLoaded && videoRef.current 
    ? (fixedZoneDuration / videoRef.current.duration) * 100 
    : 10;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">
                Trim Video - Plan {planIndex}
              </h2>
              <p className="text-sm text-slate-400">{video.title}</p>
            </div>
            <button
              onClick={handleCloseTrimmer}
              className="text-slate-400 hover:text-white transition-colors text-xl hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center"
              title="Save and close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video Preview */}
        <div className="p-6">
          <div className="relative aspect-[9/16] max-h-96 mx-auto bg-black rounded-xl overflow-hidden mb-6">
            <video
              ref={videoRef}
              src={video.videoUrl}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
              playsInline
            />
            
            {/* Video Controls Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <button
                  onClick={handlePlayPause}
                  disabled={!isVideoLoaded}
                  className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <div
              ref={timelineRef}
              className="relative h-16 bg-slate-700 rounded-lg cursor-pointer"
              onClick={handleTimelineClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Progress bar */}
              <div 
                className="absolute top-0 left-0 h-full bg-blue-500/30 rounded-lg transition-all duration-100"
                style={{ width: `${videoProgress}%` }}
              />
              
              {/* Trim zone */}
              <div 
                className="absolute top-0 h-full bg-green-500/20 border-l-2 border-r-2 border-green-500"
                style={{ 
                  left: `${startPercent}%`, 
                  width: `${endPercent - startPercent}%` 
                }}
              />

              {/* Zone handle - Single draggable zone */}
              <div
                className="absolute top-0 w-full h-full cursor-grab active:cursor-grabbing hover:bg-green-500/10 transition-colors flex items-center justify-center"
                style={{ 
                  left: `${startPercent}%`, 
                  width: `${Math.min(zoneWidthPercent, 100 - startPercent)}%`
                }}
                onMouseDown={handleMouseDown}
                title={`Drag to move zone (${fixedZoneDuration.toFixed(1)}s)`}
              >
                <div className="text-white text-xs font-bold bg-green-500/80 px-2 py-1 rounded backdrop-blur">
                  {fixedZoneDuration.toFixed(1)}s
                </div>
              </div>

              {/* Current time indicator */}
              <div
                className="absolute top-0 w-1 h-full bg-white shadow-lg"
                style={{ left: `${videoProgress}%` }}
              />
            </div>

            {/* Time displays */}
            <div className="flex justify-between items-center text-sm">
              <div className="space-y-1">
                <div className="text-slate-400">Current: <span className="text-white font-mono">{formatTime(currentTime)}</span></div>
                <div className="text-slate-400">Duration: <span className="text-white font-mono">{formatTime(trimmedDuration)}</span></div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-green-400">Start: <span className="text-white font-mono">{formatTime(startTime)}</span></div>
                <div className="text-red-400">End: <span className="text-white font-mono">{formatTime(endTime)}</span></div>
              </div>
            </div>

            {/* Zone position input */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Zone Start (s)</label>
                <input
                  type="number"
                  min="0"
                  max={isVideoLoaded && videoRef.current ? Math.max(0, videoRef.current.duration - fixedZoneDuration) : 0}
                  step="0.1"
                  value={zoneStartTime.toFixed(1)}
                  onChange={(e) => handleZoneMove(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-green-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Zone Duration (fixed)</label>
                <input
                  type="number"
                  value={fixedZoneDuration.toFixed(1)}
                  disabled
                  className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-slate-300 text-sm cursor-not-allowed"
                />
                <div className="text-xs text-slate-500 mt-1">Duration matches plan length</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between">
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>

            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-slate-600 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTrim}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg text-white font-medium transition-all"
              >
                <Scissors className="w-4 h-4" />
                <span>Apply Trim</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 