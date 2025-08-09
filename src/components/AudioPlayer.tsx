import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { AudioFile } from '../types';

interface AudioPlayerProps {
  audioFile: AudioFile;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: () => void;
  startTime: number;
  endTime: number;
  isLooping: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioFile,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onPlayPause,
  startTime,
  endTime,
  isLooping
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      onTimeUpdate(time);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };


    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [onTimeUpdate]);

  // Handle looping logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      
      // Check if we've reached the end point
      if (currentTime >= endTime) {
        // Always go back to start
        audio.currentTime = startTime;
        onTimeUpdate(startTime);
        
        if (!isLooping) {
          // Only pause if not looping
          audio.pause();
          onPlayPause();
        }
        // If looping, audio continues playing automatically
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isLooping, startTime, endTime, onTimeUpdate, onPlayPause, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (Math.abs(audio.currentTime - currentTime) > 0.1) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-3">
      <audio ref={audioRef} src={audioFile.url} preload="metadata" />
      
      <button
        onClick={onPlayPause}
        className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6 text-white" />
        ) : (
          <Play className="w-6 h-6 text-white ml-1" />
        )}
      </button>

      <div className="text-sm text-slate-300 bg-slate-700/50 rounded-lg px-3 py-2">
        <span className="font-mono text-white font-medium">{formatTime(currentTime)}</span>
        <span className="text-slate-500 mx-2">/</span>
        <span className="font-mono text-slate-400">{formatTime(duration)}</span>
      </div>
    </div>
  );
};