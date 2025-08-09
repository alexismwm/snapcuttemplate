import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Scissors } from 'lucide-react';
import { CutMarker } from '../types';
import { VideoAsset, VideoTheme } from '../types/video';
import { VideoTrimmer } from './VideoTrimmer';

// Component for trimmed video preview
const TrimmedVideo: React.FC<{
  video: VideoAsset;
  planIndex: number;
  trimSettings?: { startTime: number; endTime: number };
}> = ({ video, planIndex, trimSettings }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !trimSettings) return;

    const handleLoadedMetadata = () => {
      setIsLoaded(true);
      // Set video to start at trim start time
      videoElement.currentTime = trimSettings.startTime;
    };

    const handleTimeUpdate = () => {
      // Loop back to start when reaching trim end
      if (videoElement.currentTime >= trimSettings.endTime) {
        videoElement.currentTime = trimSettings.startTime;
      }
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [trimSettings]);

  return (
    <video
      ref={videoRef}
      src={video.videoUrl}
      autoPlay
      loop={!trimSettings} // Only loop normally if no trim settings
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
      onError={(e) => {
        // Fallback to thumbnail image if video fails
        const videoElement = e.target as HTMLVideoElement;
        videoElement.style.display = 'none';
        
        // Create and show fallback image
        const img = document.createElement('img');
        img.src = video.thumbnail;
        img.className = 'absolute inset-0 w-full h-full object-cover';
        img.alt = video.title;
        videoElement.parentNode?.appendChild(img);
      }}
    />
  );
};

interface PreviewPanelProps {
  cutMarkers: CutMarker[];
  currentTime: number;
  currentTheme: VideoTheme;
  startTime: number;
  endTime: number;
  videoAssignments?: Map<number, VideoAsset>;
  onVideoAssignmentsChange?: (assignments: Map<number, VideoAsset>) => void;
  audioDuration: number;
  onVideoTrimChange?: (planIndex: number, startTime: number, endTime: number) => void;
  videoTrimSettings?: Map<number, { startTime: number; endTime: number }>;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  cutMarkers, 
  currentTime,
  currentTheme,
  startTime,
  endTime,
  videoAssignments: externalVideoAssignments,
  onVideoAssignmentsChange,
  audioDuration,
  onVideoTrimChange,
  videoTrimSettings = new Map()
}) => {
  const [videoAssignments, setVideoAssignments] = useState<Map<number, VideoAsset>>(new Map());
  const [trimmerState, setTrimmerState] = useState<{
    isOpen: boolean;
    video: VideoAsset | null;
    planIndex: number;
  }>({
    isOpen: false,
    video: null,
    planIndex: 0
  });
  const [trimmedPlans, setTrimmedPlans] = useState<Set<number>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Synchroniser avec les assignations externes (depuis PexelsVideoManager)
  useEffect(() => {
    if (externalVideoAssignments) {
      setVideoAssignments(new Map(externalVideoAssignments));
    }
  }, [externalVideoAssignments]);

  const { currentCut, currentColor, currentPlan, currentVideo } = useMemo(() => {
    if (cutMarkers.length === 0) {
      const plan1Video = videoAssignments.get(1);
      return { 
        currentCut: null, 
        currentColor: '#3B82F6', 
        currentPlan: 1,
        currentVideo: plan1Video || null
      };
    }

    // Sort cuts by time
    const sortedCuts = [...cutMarkers].sort((a, b) => a.time - b.time);
    
    // Find which segment we're in
    for (let i = 0; i < sortedCuts.length; i++) {
      const cut = sortedCuts[i];
      const nextCut = sortedCuts[i + 1];
      
      if (currentTime >= cut.time) {
        if (!nextCut || currentTime < nextCut.time) {
          const planIndex = i + 2;
          const planVideo = videoAssignments.get(planIndex);
          return { 
            currentCut: cut, 
            currentColor: cut.color,
            currentPlan: planIndex,
            currentVideo: planVideo || null
          };
        }
      }
    }
    
    // Before first cut - Plan 1
    const plan1Video = videoAssignments.get(1);
    return { 
      currentCut: null, 
      currentColor: '#3B82F6',
      currentPlan: 1,
      currentVideo: plan1Video || null
    };
  }, [cutMarkers, currentTime, videoAssignments]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleOpenTrimmer = (video: VideoAsset, planIndex: number) => {
    setTrimmerState({
      isOpen: true,
      video,
      planIndex
    });
  };

  // Calculate plan duration
  const calculatePlanDuration = (planIndex: number): number => {
    const sortedCuts = [...cutMarkers].sort((a, b) => a.time - b.time);
    
    if (planIndex === 1) {
      // Plan 1: from startTime to first cut (or endTime if no cuts)
      const firstCutTime = sortedCuts[0]?.time || endTime;
      return Math.max(0.1, firstCutTime - startTime);
    } else {
      // Other plans: from previous cut to next cut (or endTime)
      const cutIndex = planIndex - 2; // Plan 2 = index 0, Plan 3 = index 1, etc.
      const currentCut = sortedCuts[cutIndex];
      const nextCut = sortedCuts[cutIndex + 1];
      
      if (currentCut) {
        const planEndTime = nextCut ? nextCut.time : endTime;
        return Math.max(0.1, planEndTime - currentCut.time);
      }
    }
    return 1; // Default 1 second
  };

  const handleCloseTrimmer = () => {
    setTrimmerState({
      isOpen: false,
      video: null,
      planIndex: 0
    });
  };

  const handleTrimChange = (planIndex: number, startTime: number, endTime: number) => {
    onVideoTrimChange?.(planIndex, startTime, endTime);
    
    // Mark this plan as trimmed
    setTrimmedPlans(prev => new Set(prev).add(planIndex));
    
    // Show success notification
    const duration = endTime - startTime;
    console.log(`✅ Trim applied to Plan ${planIndex}: ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s (${duration.toFixed(1)}s)`);
    
    // Simple non-blocking notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10B981, #059669);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    notification.innerHTML = `✅ Plan ${planIndex} trimmed: ${duration.toFixed(1)}s`;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  };

  // Calcul des durées correctes pour chaque plan
  const getPlanDuration = (planIndex: number): number => {
    const sortedCuts = [...cutMarkers].sort((a, b) => a.time - b.time);
    
    if (planIndex === 1) {
      // Plan 1: du startTime à la première cut (ou endTime si pas de cuts)
      const firstCutTime = sortedCuts[0]?.time || endTime;
      return firstCutTime - startTime;
    } else {
      // Plan N: de la cut N-1 à la cut N (ou endTime pour le dernier plan)
      const previousCutTime = sortedCuts[planIndex - 2]?.time || startTime;
      const currentCutTime = sortedCuts[planIndex - 1]?.time || endTime;
      return currentCutTime - previousCutTime;
    }
  };

  const getCurrentPlanNumber = () => {
    const sortedCuts = cutMarkers.sort((a, b) => a.time - b.time);
    
    for (let i = 0; i < sortedCuts.length; i++) {
      const cut = sortedCuts[i];
      const nextCut = sortedCuts[i + 1];
      
      if (currentTime >= cut.time) {
        if (!nextCut || currentTime < nextCut.time) {
          return i + 2;
        }
      }
    }
    
    return 1; // Before first cut
  };

  // Check if video is too short for the plan
  const isVideoTooShort = (video: VideoAsset | undefined, planDuration: number): boolean => {
    if (!video) return false;
    return video.duration < planDuration;
  };

  const nextCuts = useMemo(() => {
    return cutMarkers
      .filter(cut => cut.time > currentTime)
      .sort((a, b) => a.time - b.time)
      .slice(0, 3);
  }, [cutMarkers, currentTime]);

  return (
    <div className="space-y-6">
      {/* Mobile Phone Preview */}
      <div className="flex flex-col items-center">
        <div className="text-sm text-slate-400 mb-3 font-medium">📱 Preview Mobile</div>
        
        <div className="relative">
          {/* Phone Frame */}
          <div
            className="w-44 h-78 bg-black rounded-3xl p-2 shadow-2xl border-4 border-slate-700"
            style={{ aspectRatio: '9/19.5' }}
          >
            {/* Screen */}
            <div 
              className="w-full h-full rounded-2xl overflow-hidden relative"
              style={{ aspectRatio: '9/16' }}
            >
              {/* Video Background */}
              {currentVideo ? (
                <>
                  <TrimmedVideo
                    video={currentVideo}
                    planIndex={currentPlan}
                    trimSettings={videoTrimSettings.get(currentPlan)}
                  />
                  {/* Dark overlay for text readability */}
                  <div className="absolute inset-0 bg-black/30"></div>
                </>
              ) : (
                /* Fallback color background */
                <div 
                  className="absolute inset-0"
                  style={{ backgroundColor: currentColor }}
                />
              )}
              
              {/* Content Overlay */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-white text-2xl font-bold bg-black/50 px-4 py-2 rounded-lg">
                  Plan {getCurrentPlanNumber()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-slate-300 flex items-center space-x-2">
            <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
            <span>Timeline</span>
          </h4>
        </div>
        
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {/* Plan 1 (before first cut) */}
          {(() => {
            const sortedCuts = cutMarkers.sort((a, b) => a.time - b.time);
            const plan1Duration = getPlanDuration(1);
            const plan1Video = videoAssignments.get(1);
            const currentPlan = getCurrentPlanNumber();
            const isActive = currentPlan === 1;
            const isPast = currentTime > (sortedCuts[0]?.time || endTime);
            
            return (
              <div
                className={`p-4 rounded-xl border transition-all duration-200 ${
                  isActive 
                    ? 'border-green-400 bg-green-400/20 shadow-lg shadow-green-400/25' 
                    : isPast 
                    ? 'border-slate-600 bg-slate-700/30 opacity-60' 
                    : 'border-slate-600 bg-slate-700/50 hover:bg-slate-700/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-lg"
                    >
                      1
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold">Plan 1</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {formatTime(startTime)} → {formatTime(sortedCuts[0]?.time || endTime)}
                        {plan1Duration > 0 && ` • ${Math.round(plan1Duration)}s duration`}
                      </div>
                      {plan1Video && (
                        <div className="text-xs text-blue-300 mt-1 truncate max-w-[200px]">
                          📹 {plan1Video.title}
                          {trimmedPlans.has(1) && (
                            <span className="ml-2 text-xs text-green-400 font-semibold">✂️ Trimmed</span>
                          )}
                          {isVideoTooShort(plan1Video, plan1Duration) && (
                            <span className="ml-2 text-xs text-yellow-400 font-semibold" title={`Video duration: ${plan1Video.duration.toFixed(1)}s < Plan duration: ${plan1Duration.toFixed(1)}s`}>
                              ⚠️ Too short
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {plan1Video && (
                      <button
                        onClick={() => handleOpenTrimmer(plan1Video, 1)}
                        className="p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors group"
                        title="Trim video for Plan 1"
                      >
                        <Scissors className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                      </button>
                    )}
                    {isActive && (
                      <div className="text-green-400 text-xs font-bold animate-pulse bg-green-400/20 px-2 py-1 rounded-full">
                        ACTIVE
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Cuts et plans suivants */}
          {cutMarkers
            .sort((a, b) => a.time - b.time)
            .map((cut, index) => {
              const currentPlan = getCurrentPlanNumber();
              const planIndex = index + 2;
              const isActive = currentPlan === planIndex;
              const isPast = currentTime > cut.time && !isActive;
              const planDuration = getPlanDuration(planIndex);
              
              const planVideo = videoAssignments.get(planIndex);
              
              return (
                <div
                  key={cut.id}
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    isActive 
                      ? 'border-green-400 bg-green-400/20 shadow-lg shadow-green-400/25' 
                      : isPast 
                      ? 'border-slate-600 bg-slate-700/30 opacity-60' 
                      : 'border-slate-600 bg-slate-700/50 hover:bg-slate-700/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-lg"
                        style={{ backgroundColor: cut.color }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">Plan {planIndex}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {formatTime(cut.time)}
                          {planDuration > 0 && ` • ${Math.round(planDuration)}s duration`}
                        </div>
                        {planVideo && (
                          <div className="text-xs text-blue-300 mt-1 truncate max-w-[200px]">
                            📹 {planVideo.title}
                            {trimmedPlans.has(planIndex) && (
                              <span className="ml-2 text-xs text-green-400 font-semibold">✂️ Trimmed</span>
                            )}
                            {isVideoTooShort(planVideo, planDuration) && (
                              <span className="ml-2 text-xs text-yellow-400 font-semibold" title={`Video duration: ${planVideo.duration.toFixed(1)}s < Plan duration: ${planDuration.toFixed(1)}s`}>
                                ⚠️ Too short
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {planVideo && (
                        <button
                          onClick={() => handleOpenTrimmer(planVideo, planIndex)}
                          className="p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors group"
                          title={`Trim video for Plan ${planIndex}`}
                        >
                          <Scissors className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                        </button>
                      )}
                      {isActive && (
                        <div className="text-green-400 text-xs font-bold animate-pulse bg-green-400/20 px-2 py-1 rounded-full">
                          ACTIVE
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Stats */}
      <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
        <div className="text-sm text-slate-400 mb-3 font-medium">📊 Template Stats</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-white font-bold text-lg">{cutMarkers.length + 1}</div>
            <div className="text-slate-400">Total Plans</div>
          </div>
          <div>
            <div className="text-white font-bold text-lg">{videoAssignments.size}</div>
            <div className="text-slate-400">Videos Assigned</div>
          </div>
        </div>
      </div>

      {/* Video Trimmer Modal */}
      {trimmerState.isOpen && trimmerState.video && (
        <VideoTrimmer
          video={trimmerState.video}
          planIndex={trimmerState.planIndex}
          audioDuration={audioDuration}
          planDuration={calculatePlanDuration(trimmerState.planIndex)}
          onTrimChange={handleTrimChange}
          onClose={handleCloseTrimmer}
        />
      )}
    </div>
  );
};