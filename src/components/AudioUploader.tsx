import React, { useCallback } from 'react';
import { Upload, Music, Sparkles } from 'lucide-react';
import { AudioFile } from '../types';

interface AudioUploaderProps {
  onAudioLoad: (audioFile: AudioFile) => void;
  isLoading: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAudioLoad, isLoading }) => {
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    
    audio.addEventListener('loadedmetadata', () => {
      const audioFile: AudioFile = {
        file,
        url,
        duration: audio.duration,
        name: file.name
      };
      onAudioLoad(audioFile);
    });

    audio.load();
  }, [onAudioLoad]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      const fakeEvent = { target: { files: [file] } } as any;
      handleFileUpload(fakeEvent);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  return (
    <div className="text-center">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-center justify-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-4xl font-bold text-white mb-2">
              Beat-Synced Video Templates
            </h1>
            <p className="text-xl text-slate-400">
              Create perfectly timed cuts for your Snapcut projects
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <Upload className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Upload Audio</h3>
            <p className="text-sm text-slate-400">Import your music track and let our AI detect the beats automatically</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <Music className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Add Cuts</h3>
            <p className="text-sm text-slate-400">Place cuts on the timeline, synced to the beat for perfect timing</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <Sparkles className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Export</h3>
            <p className="text-sm text-slate-400">Download your Snapcut project file and trimmed audio</p>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className="relative border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-2xl p-12 transition-all duration-300 bg-slate-800/30 backdrop-blur-sm hover:bg-slate-800/50 group"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300">
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Music className="w-10 h-10 text-white" />
              )}
            </div>
            {!isLoading && (
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <Upload className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-3">
              {isLoading ? 'Processing Your Audio...' : 'Upload Your Music'}
            </h3>
            <p className="text-slate-400 text-lg mb-6 max-w-md">
              {isLoading 
                ? 'Analyzing beats and preparing your timeline...' 
                : 'Drag and drop an audio file or click to browse'
              }
            </p>
          </div>

          {!isLoading && (
            <label className="cursor-pointer group">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
              <div className="flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                <Upload className="w-5 h-5 text-white" />
                <span className="font-semibold text-white text-lg">Choose Audio File</span>
              </div>
            </label>
          )}

          <div className="flex flex-wrap justify-center gap-2 text-sm text-slate-500">
            <span className="bg-slate-700/50 px-3 py-1 rounded-full">MP3</span>
            <span className="bg-slate-700/50 px-3 py-1 rounded-full">WAV</span>
            <span className="bg-slate-700/50 px-3 py-1 rounded-full">FLAC</span>
            <span className="bg-slate-700/50 px-3 py-1 rounded-full">M4A</span>
          </div>
        </div>
      </div>
    </div>
  );
};