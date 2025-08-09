import React, { useState } from 'react';
import { Search, Check, Plus, X } from 'lucide-react';
import { VideoTheme } from '../types/video';
import { getPopularThemes, searchThemes } from '../data/themes';

interface ThemeSelectorProps {
  selectedTheme: VideoTheme;
  onThemeChange: (theme: VideoTheme, customKeywords?: string[]) => void;
  isLoading?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  selectedTheme,
  onThemeChange,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  
  // Obtenir les thèmes à afficher
  const themes = searchQuery 
    ? searchThemes(searchQuery)
    : getPopularThemes();

  const handleThemeSelect = (theme: VideoTheme) => {
    if (!isLoading) {
      onThemeChange(theme, customKeywords.length > 0 ? customKeywords : undefined);
    }
  };

  const addCustomKeyword = () => {
    if (keywordInput.trim() && !customKeywords.includes(keywordInput.trim())) {
      setCustomKeywords([...customKeywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeCustomKeyword = (keyword: string) => {
    setCustomKeywords(customKeywords.filter(k => k !== keyword));
  };

  const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomKeyword();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <span>🎬</span>
            <span>Video Theme</span>
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Choose a theme for your video content
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search themes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none transition-colors"
        />
      </div>

      {/* Custom Keywords */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300">
            Custom Keywords (optional)
          </label>
          <span className="text-xs text-slate-500">
            e.g., "Paris", "sunset", "people"
          </span>
        </div>
        
        {/* Add keyword input */}
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Add specific keyword..."
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyPress={handleKeywordKeyPress}
            className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none transition-colors text-sm"
          />
          <button
            onClick={addCustomKeyword}
            disabled={!keywordInput.trim() || customKeywords.includes(keywordInput.trim())}
            className="px-3 py-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Keywords list */}
        {customKeywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customKeywords.map((keyword) => (
              <span
                key={keyword}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600/20 text-blue-200 rounded-full text-sm"
              >
                <span>{keyword}</span>
                <button
                  onClick={() => removeCustomKeyword(keyword)}
                  className="text-blue-300 hover:text-blue-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {themes.map((theme) => {
          const isSelected = theme.id === selectedTheme;
          
          return (
            <button
              key={theme.id}
              onClick={() => handleThemeSelect(theme.id)}
              disabled={isLoading}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                ${isSelected 
                  ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/25' 
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
              `}
              style={{ 
                '--theme-color': theme.color 
              } as React.CSSProperties}
            >
              {/* Theme Icon & Color Bar */}
              <div className="flex items-center justify-between mb-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: theme.color }}
                >
                  {theme.icon}
                </div>
                
                {isSelected && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Theme Info */}
              <div>
                <h4 className="font-semibold text-white text-sm mb-1">
                  {theme.name}
                </h4>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {theme.description}
                </p>
              </div>

              {/* Loading Overlay */}
              {isLoading && isSelected && (
                <div className="absolute inset-0 bg-slate-800/50 rounded-xl flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* No Results */}
      {searchQuery && themes.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-medium">No themes found</p>
          <p className="text-sm mt-1 opacity-75">Try a different search term</p>
        </div>
      )}

      {/* Theme Stats */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-700/50">
        <span>{themes.length} themes available</span>
        <div className="flex items-center space-x-2">
          <span>Selected: {getPopularThemes().find(t => t.id === selectedTheme)?.name}</span>
          {customKeywords.length > 0 && (
            <span className="text-blue-400">+{customKeywords.length} keywords</span>
          )}
        </div>
      </div>
    </div>
  );
}; 