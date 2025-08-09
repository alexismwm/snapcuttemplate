import React, { useState, useEffect } from 'react';
import { Monitor, Database, Wifi } from 'lucide-react';
import { videoService } from '../services/videoService';

export const VideoDebug: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      setStats(videoService.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5s

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
        title="Video System Debug"
      >
        <Monitor className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-slate-800 rounded-xl border border-slate-600 shadow-2xl p-4 text-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white flex items-center space-x-2">
              <span>🎬</span>
              <span>Video System</span>
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* API Status */}
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Wifi className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium">Pexels API</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={stats.api.hasApiKey ? 'text-green-400' : 'text-orange-400'}>
                    {stats.api.hasApiKey ? '✅ Connected' : '⚠️ Mock Mode'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Requests/Hour:</span>
                  <span className="text-white">
                    {stats.api.requestsThisHour}/{stats.api.maxRequestsPerHour}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reset in:</span>
                  <span className="text-white">
                    {Math.round(stats.api.timeUntilReset)}min
                  </span>
                </div>
              </div>
            </div>

            {/* Cache Status */}
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-4 h-4 text-green-400" />
                <span className="text-white font-medium">Cache</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Memory:</span>
                  <span className="text-white">{stats.cache.memory.totalVideos} videos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Storage:</span>
                  <span className="text-white">
                    {stats.cache.storage.totalVideos} videos ({stats.cache.storage.sizeKB}KB)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Themes:</span>
                  <span className="text-white">{stats.availableThemes.length}</span>
                </div>
              </div>
            </div>

            {/* Available Themes */}
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-white font-medium mb-2">Cached Themes</div>
              <div className="flex flex-wrap gap-1">
                {stats.availableThemes.length > 0 ? (
                  stats.availableThemes.map((theme: string) => (
                    <span
                      key={theme}
                      className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs"
                    >
                      {theme}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 text-xs">None cached yet</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2 pt-2 border-t border-slate-600">
              <button
                onClick={() => {
                  videoService.clearCache();
                  setStats(videoService.getStats());
                }}
                className="flex-1 px-3 py-2 bg-red-600/20 text-red-300 rounded-lg text-xs hover:bg-red-600/30 transition-colors"
              >
                Clear Cache
              </button>
              <button
                onClick={() => {
                  videoService.preloadPopularThemes();
                }}
                className="flex-1 px-3 py-2 bg-blue-600/20 text-blue-300 rounded-lg text-xs hover:bg-blue-600/30 transition-colors"
              >
                Preload
              </button>
            </div>
            
            {/* Video Shuffle */}
            <div className="pt-2 border-t border-slate-600">
              <button
                onClick={() => {
                  import('../services/planVideoAssigner').then(({ planVideoAssigner }) => {
                    planVideoAssigner.shuffleAssignments();
                    console.log('🎲 Videos shuffled! Check the preview panel.');
                  });
                }}
                className="w-full px-3 py-2 bg-purple-600/20 text-purple-300 rounded-lg text-xs hover:bg-purple-600/30 transition-colors flex items-center justify-center space-x-2"
              >
                <span>🎲</span>
                <span>Shuffle Videos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 