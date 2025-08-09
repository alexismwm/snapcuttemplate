import React, { useState } from 'react';
import { X, AlertTriangle, Shuffle, Zap } from 'lucide-react';

interface RandomModeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (planCount: number) => void;
  hasInOutPoints: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  existingCutsCount: number;
}

export const RandomModeDialog: React.FC<RandomModeDialogProps> = ({
  isOpen,
  onClose,
  onGenerate,
  hasInOutPoints,
  startTime,
  endTime,
  duration,
  existingCutsCount
}) => {
  const [planCount, setPlanCount] = useState(4);
  const [replaceExisting, setReplaceExisting] = useState(true);

  if (!isOpen) return null;

  const handleGenerate = () => {
    onGenerate(planCount);
    onClose();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const activeDuration = endTime - startTime;
  const maxRecommendedPlans = Math.floor(activeDuration / 2); // 1 plan par 2 secondes maximum

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <Shuffle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Random Mode</h2>
              <p className="text-sm text-slate-400">Generate beat-synced cuts automatically</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Validation Warning */}
          {!hasInOutPoints && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-amber-400 font-semibold">Setup Required</h3>
                  <p className="text-sm text-amber-300/90 mt-1">
                    Please set IN and OUT points first to define the active region for random cuts.
                  </p>
                  <div className="flex items-center space-x-4 mt-3 text-xs text-amber-300/70">
                    <span>Press <kbd className="bg-amber-500/20 px-1 py-0.5 rounded">I</kbd> to set IN point</span>
                    <span>Press <kbd className="bg-amber-500/20 px-1 py-0.5 rounded">O</kbd> to set OUT point</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current State Info */}
          <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
            <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <span>Current Settings</span>
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-400">Active Region</div>
                <div className="text-white font-mono">
                  {formatTime(startTime)} → {formatTime(endTime)}
                </div>
                <div className="text-slate-400 text-xs">
                  {Math.round(activeDuration)}s duration
                </div>
              </div>
              <div>
                <div className="text-slate-400">Existing Cuts</div>
                <div className="text-white font-bold text-lg">{existingCutsCount}</div>
                {existingCutsCount > 0 && (
                  <div className="text-slate-400 text-xs">
                    {replaceExisting ? 'Will be replaced' : 'Will be kept'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Plan Count Selection */}
          <div className="space-y-4">
            <label className="block">
              <span className="text-white font-semibold mb-2 block">Number of Plans</span>
              <div className="relative">
                <input
                  type="range"
                  min="2"
                  max={Math.max(8, maxRecommendedPlans)}
                  value={planCount}
                  onChange={(e) => setPlanCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!hasInOutPoints}
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>2</span>
                  <span className="text-white font-bold">{planCount} plans ({planCount - 1} cuts)</span>
                  <span>{Math.max(8, maxRecommendedPlans)}</span>
                </div>
              </div>
              {planCount > maxRecommendedPlans && (
                <p className="text-amber-400 text-xs mt-2">
                  ⚠️ Many cuts for this duration - might feel too fast
                </p>
              )}
            </label>
          </div>

          {/* Options */}
          {existingCutsCount > 0 && (
            <div className="space-y-3">
              <h3 className="text-white font-semibold">Options</h3>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="w-4 h-4 text-purple-500 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                  disabled={!hasInOutPoints}
                />
                <span className="text-slate-300">Replace existing cuts</span>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!hasInOutPoints}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg disabled:shadow-none flex items-center justify-center space-x-2"
            >
              <Shuffle className="w-4 h-4" />
              <span>Generate Cuts</span>
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .slider::-webkit-slider-thumb {
            appearance: none;
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: linear-gradient(45deg, #9333ea, #ec4899);
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }
          
          .slider::-moz-range-thumb {
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: linear-gradient(45deg, #9333ea, #ec4899);
            cursor: pointer;
            border: none;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }
        `
      }} />
    </div>
  );
}; 