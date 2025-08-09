import React, { useState, useEffect } from 'react';
import { X, Search, Play, Shuffle, Loader } from 'lucide-react';
import { VideoAsset, VideoTheme } from '../types/video';
import { videoService } from '../services/videoService';

interface VideoSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (video: VideoAsset) => void;
  currentTheme: VideoTheme;
  planNumber: number;
  currentVideo?: VideoAsset;
}

export const VideoSelectionModal: React.FC<VideoSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  currentTheme,
  planNumber,
  currentVideo
}) => {
  const [availableVideos, setAvailableVideos] = useState<VideoAsset[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<VideoAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoAsset | null>(currentVideo || null);

  // Load videos when modal opens
  useEffect(() => {
    if (isOpen) {
      loadVideos();
    }
  }, [isOpen, currentTheme]);

  // Filter videos based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredVideos(availableVideos);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = availableVideos.filter(video => 
        video.title.toLowerCase().includes(query) ||
        video.tags.some(tag => tag.toLowerCase().includes(query))
      );
      setFilteredVideos(filtered);
    }
  }, [searchQuery, availableVideos]);

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      const videos = await videoService.getVideosByTheme(currentTheme);
      setAvailableVideos(videos);
      setFilteredVideos(videos);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVideo = (video: VideoAsset) => {
    setSelectedVideo(video);
    onSelectVideo(video);
    onClose();
  };

  const handleShuffle = () => {
    if (filteredVideos.length > 0) {
      const randomVideo = filteredVideos[Math.floor(Math.random() * filteredVideos.length)];
      handleSelectVideo(randomVideo);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <span>🎬</span>
              <span>Select Video - Plan {planNumber}</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Theme: {currentTheme} • {filteredVideos.length} videos available
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleShuffle}
              disabled={isLoading || filteredVideos.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600/20 text-purple-300 rounded-lg hover:bg-purple-600/30 transition-colors disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4" />
              <span>Random</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-slate-700/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Video Grid */}
        <div className="p-6 overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
                <p className="text-slate-400">Loading videos...</p>
              </div>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-medium">No videos found</p>
              <p className="text-sm mt-1 opacity-75">Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredVideos.map((video) => {
                const isSelected = selectedVideo?.id === video.id;
                const isCurrent = currentVideo?.id === video.id;
                
                return (
                  <div
                    key={video.id}
                    className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      isCurrent
                        ? 'border-green-400 shadow-lg shadow-green-400/25'
                        : isSelected
                        ? 'border-blue-400 shadow-lg shadow-blue-400/25'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => handleSelectVideo(video)}
                  >
                    {/* Video Thumbnail */}
                    <div className="aspect-[9/16] bg-slate-900 relative overflow-hidden">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <Play className="w-5 h-5 text-white ml-1" />
                        </div>
                      </div>

                      {/* Current indicator */}
                      {isCurrent && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                          Current
                        </div>
                      )}

                      {/* Selected indicator */}
                      {isSelected && !isCurrent && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                          Selected
                        </div>
                      )}
                    </div>

                    {/* Video Info */}
                    <div className="p-3 bg-slate-800/50">
                      <h4 className="text-sm font-medium text-white truncate mb-1">
                        {video.title}
                      </h4>
                      <p className="text-xs text-slate-400 mb-2">
                        {Math.round(video.duration)}s • {video.width}x{video.height}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {video.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700/30 bg-slate-800/30">
          <div className="text-sm text-slate-400">
            {currentVideo && (
              <>Currently: <span className="text-white font-medium">{currentVideo.title}</span></>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 