import React, { useState, useCallback, useMemo } from 'react';
import { Shuffle, Search, Download, X, RefreshCw, Filter, User } from 'lucide-react';
import { VideoTheme, VideoAsset } from '../types/video';
import { pexelsService } from '../services/pexelsService';
import { FileNamingService } from '../services/fileNamingService';

interface PexelsVideoManagerProps {
  cutMarkers: any[];
  startTime: number;
  endTime: number;
  onVideoAssignmentsChange: (assignments: Map<number, VideoAsset>) => void;
}

const THEMES: { value: VideoTheme; label: string; icon: string }[] = [
  { value: 'Travel', label: 'Travel', icon: '✈️' },
  { value: 'Lifestyle', label: 'Lifestyle', icon: '🏠' },
  { value: 'Fashion', label: 'Fashion', icon: '👗' },
  { value: 'Retro', label: 'Retro', icon: '📼' },
  { value: 'Party', label: 'Party', icon: '🎉' },
  { value: 'Sport', label: 'Sport', icon: '⚽' },
  { value: 'Games', label: 'Games', icon: '🎮' },
  { value: 'Food', label: 'Food', icon: '🍴' },
  { value: 'Vlog', label: 'Vlog', icon: '📱' },
  { value: 'social', label: 'Social', icon: '📢' },
];

export const PexelsVideoManager: React.FC<PexelsVideoManagerProps> = ({
  cutMarkers,
  startTime,
  endTime,
  onVideoAssignmentsChange
}) => {
  const [showManager, setShowManager] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<VideoTheme>('Travel');
  const [keywords, setKeywords] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<VideoAsset[]>([]);
  const [videoAssignments, setVideoAssignments] = useState<Map<number, VideoAsset>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  
  // Nouveaux filtres
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [minDuration, setMinDuration] = useState<number>(0);
  const [maxDuration, setMaxDuration] = useState<number>(60);

  // Calcul du nombre de plans
  const totalPlans = cutMarkers.length + 1;

  // Génération automatique du nom du projet avec le service centralisé
  const projectFilename = useMemo(() => {
    const projectSettings = FileNamingService.extractSettingsFromDOM() || {
      category: selectedTheme,
      templateNumber: Math.floor(startTime).toString().padStart(3, '0'),
      musicId: Math.floor(endTime).toString().padStart(3, '0')
    };
    
    const namingContext = FileNamingService.createContext(
      projectSettings,
      cutMarkers,
      endTime - startTime
    );
    
    return FileNamingService.generateProjectFilename(namingContext);
  }, [selectedTheme, startTime, endTime, totalPlans, cutMarkers]);

  // Filtrer les résultats selon les critères
  const filteredResults = useMemo(() => {
    let filtered = [...searchResults];
    
    // Filtre par auteur
    if (selectedAuthor) {
      filtered = filtered.filter(video => video.author.name === selectedAuthor);
    }
    
    // Filtre par durée
    filtered = filtered.filter(video => 
      video.duration >= minDuration && video.duration <= maxDuration
    );
    
    return filtered;
  }, [searchResults, selectedAuthor, minDuration, maxDuration]);

  // Obtenir la liste unique des auteurs
  const availableAuthors = useMemo(() => {
    const authors = Array.from(new Set(searchResults.map(video => video.author.name)));
    return authors.sort();
  }, [searchResults]);

  // Réinitialiser les filtres
  const resetFilters = useCallback(() => {
    setSelectedAuthor('');
    setMinDuration(0);
    setMaxDuration(60);
  }, []);

  // Sélectionner un auteur
  const handleAuthorClick = useCallback((authorName: string) => {
    setSelectedAuthor(selectedAuthor === authorName ? '' : authorName);
  }, [selectedAuthor]);

  const searchVideos = useCallback(async (loadMore = false) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const pageToLoad = loadMore ? currentPage + 1 : 1;
      const keywordArray = keywords.trim() 
        ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
        : [];

      const results = await pexelsService.searchVideosByTheme(
        {
          theme: selectedTheme,
          perPage: 30,
          page: pageToLoad,
          orientation: 'portrait'
        },
        keywordArray
      );

      if (loadMore) {
        setSearchResults(prev => [...prev, ...results]);
        setCurrentPage(pageToLoad);
      } else {
        setSearchResults(results);
        setCurrentPage(1);
      }

      // Vérifier s'il y a plus de vidéos (si on reçoit moins de 30 vidéos, c'est qu'on est à la fin)
      setHasMoreVideos(results.length === 30);
      
    } catch (error) {
      console.error('Error searching videos:', error);
      alert('Erreur lors de la recherche de vidéos. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTheme, keywords, isLoading, currentPage]);

  const loadMoreVideos = useCallback(() => {
    searchVideos(true);
  }, [searchVideos]);

  const shuffleVideos = useCallback(() => {
    if (filteredResults.length === 0) {
      alert(searchResults.length === 0 ? 'Lancez d\'abord une recherche de vidéos !' : 'Aucune vidéo ne correspond aux filtres actuels !');
      return;
    }

    const newAssignments = new Map<number, VideoAsset>();
    const availableVideos = [...filteredResults];

    // Assigner une vidéo aléatoire à chaque plan
    for (let planIndex = 1; planIndex <= totalPlans; planIndex++) {
      if (availableVideos.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableVideos.length);
        const selectedVideo = availableVideos.splice(randomIndex, 1)[0];
        newAssignments.set(planIndex, selectedVideo);
      }
    }

    setVideoAssignments(newAssignments);
    onVideoAssignmentsChange(newAssignments);
  }, [filteredResults, searchResults.length, totalPlans, onVideoAssignmentsChange]);

  const assignVideoToPlan = (planIndex: number, video: VideoAsset) => {
    const newAssignments = new Map(videoAssignments);
    newAssignments.set(planIndex, video);
    setVideoAssignments(newAssignments);
    onVideoAssignmentsChange(newAssignments);
  };

  const removeVideoFromPlan = (planIndex: number) => {
    const newAssignments = new Map(videoAssignments);
    newAssignments.delete(planIndex);
    setVideoAssignments(newAssignments);
    onVideoAssignmentsChange(newAssignments);
  };

  const downloadAllVideos = useCallback(async () => {
    if (videoAssignments.size === 0) {
      alert('Aucune vidéo assignée à télécharger !');
      return;
    }

    const baseProjectName = projectFilename.replace('.json', '').replace('_project', '');
    
    setIsLoading(true);
    try {
      let videoIndex = 1;
      for (const [planIndex, video] of videoAssignments.entries()) {
        const filename = `${baseProjectName}_video${videoIndex}.mp4`;
        
        // Télécharger la vidéo
        const response = await fetch(video.videoUrl);
        const blob = await response.blob();
        
        // Créer le lien de téléchargement
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Petit délai entre les téléchargements
        await new Promise(resolve => setTimeout(resolve, 500));
        videoIndex++;
      }
      
              console.log(`✅ ${videoAssignments.size} vidéos téléchargées avec le naming: ${projectFilename.replace('.json', '_project')}`);
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      alert('Erreur lors du téléchargement des vidéos.');
    } finally {
      setIsLoading(false);
    }
  }, [videoAssignments, projectFilename]);

  if (!showManager) {
    return (
      <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
        <button
          onClick={() => setShowManager(true)}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <Search className="w-5 h-5" />
          <span>Add Pexel Videos</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-700/30 rounded-xl p-6 border border-slate-600/30 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Search className="w-5 h-5" />
          <span>Pexels Video Manager</span>
        </h3>
        <button
          onClick={() => setShowManager(false)}
          className="text-slate-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Theme Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Thème
        </label>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              onClick={() => setSelectedTheme(theme.value)}
              className={`p-3 rounded-lg border-2 transition-all duration-200 text-center ${
                selectedTheme === theme.value
                  ? 'border-blue-400 bg-blue-400/20 text-white'
                  : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="text-lg mb-1">{theme.icon}</div>
              <div className="text-xs font-medium">{theme.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Project Name Display */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Nom du projet (généré automatiquement)
        </label>
        <div className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm font-mono">
          {projectFilename.replace('.json', '')}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          Format: {selectedTheme}_{Math.floor(startTime).toString().padStart(3, '0')}_{Math.floor(endTime).toString().padStart(3, '0')}_{totalPlans}_{Math.floor(endTime - startTime)}s_project
        </div>
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Mots-clés (séparés par des virgules, optionnel)
        </label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="nature, sunset, ocean..."
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none transition-colors"
        />
      </div>

      {/* Filtres */}
      {searchResults.length > 0 && (
        <div className="border-t border-slate-600 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-300 flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span>Filtres</span>
            </h4>
            <button
              onClick={resetFilters}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Réinitialiser
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Filtre par durée */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Durée (secondes)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={minDuration}
                  onChange={(e) => setMinDuration(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Min"
                  className="w-full px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-white text-xs focus:border-blue-400 focus:outline-none"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(Math.max(minDuration, parseInt(e.target.value) || 60))}
                  placeholder="Max"
                  className="w-full px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-white text-xs focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Filtre par auteur */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Auteur ({availableAuthors.length})
              </label>
              <select
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
                className="w-full px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-white text-xs focus:border-blue-400 focus:outline-none"
              >
                <option value="">Tous les auteurs</option>
                {availableAuthors.map((author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Statistiques des filtres */}
          <div className="mt-2 text-xs text-slate-400">
            {filteredResults.length} vidéo{filteredResults.length !== 1 ? 's' : ''} correspondant{filteredResults.length !== 1 ? 'es' : 'e'}
            {selectedAuthor && ` • Auteur: ${selectedAuthor}`}
            {(minDuration > 0 || maxDuration < 60) && ` • Durée: ${minDuration}-${maxDuration}s`}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => {
            setCurrentPage(1);
            setHasMoreVideos(true);
            searchVideos(false);
          }}
          disabled={isLoading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          {isLoading && currentPage === 1 ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>Rechercher</span>
        </button>

        <button
          onClick={shuffleVideos}
          disabled={filteredResults.length === 0 || isLoading}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
        >
          <Shuffle className="w-4 h-4" />
          <span>Shuffle</span>
        </button>

        {videoAssignments.size > 0 && (
          <button
            onClick={downloadAllVideos}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Download All</span>
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-white mb-3">
            Résultats de recherche ({searchResults.length} vidéos{filteredResults.length !== searchResults.length ? ` • ${filteredResults.length} affichées` : ''})
          </h4>
          {filteredResults.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Filter className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune vidéo ne correspond aux filtres</p>
              <button
                onClick={resetFilters}
                className="text-blue-400 hover:text-blue-300 text-sm mt-2 underline"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2 max-h-[600px] overflow-y-auto custom-scrollbar">
              {filteredResults.map((video) => (
              <div
                key={video.id}
                className="relative group bg-slate-800/50 rounded-lg overflow-hidden border border-slate-600/50 hover:border-slate-500 transition-colors"
              >
                <div className="aspect-[9/16] relative">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <div className="text-xs text-white font-medium truncate mb-1">
                    {video.title}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center space-x-1">
                    <span>{video.duration}s</span>
                    <span>•</span>
                    <button
                      onClick={() => handleAuthorClick(video.author.name)}
                      className={`hover:text-blue-400 transition-colors underline decoration-dotted ${
                        selectedAuthor === video.author.name ? 'text-blue-400 font-medium' : ''
                      }`}
                      title={`Filtrer par ${video.author.name}`}
                    >
                      {video.author.name}
                    </button>
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xs text-white mb-2 font-medium">Assigner au plan:</div>
                    <div className="flex flex-wrap justify-center gap-1">
                      {Array.from({ length: totalPlans }, (_, i) => i + 1).map((planIndex) => (
                        <button
                          key={planIndex}
                          onClick={() => assignVideoToPlan(planIndex, video)}
                          className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                            videoAssignments.get(planIndex)?.id === video.id
                              ? 'bg-green-500 text-white shadow-lg'
                              : 'bg-slate-600 text-white hover:bg-blue-500'
                          }`}
                        >
                          {planIndex}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
          
          {/* Load More Button */}
          {hasMoreVideos && !isLoading && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMoreVideos}
                className="bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center space-x-2"
              >
                <span>Load 30 more videos</span>
              </button>
            </div>
          )}
          
          {isLoading && currentPage > 1 && (
            <div className="flex justify-center mt-4">
              <div className="text-slate-400 text-sm flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading more videos...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Assignments */}
      {videoAssignments.size > 0 && (
        <div>
          <h4 className="text-md font-medium text-white mb-3">
            Vidéos assignées ({videoAssignments.size}/{totalPlans} plans)
          </h4>
          <div className="space-y-2">
            {Array.from(videoAssignments.entries()).map(([planIndex, video]) => (
              <div
                key={planIndex}
                className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 border border-slate-600/50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {planIndex}
                  </div>
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-12 h-8 object-cover rounded"
                  />
                  <div>
                    <div className="text-sm text-white font-medium truncate max-w-[200px]">
                      {video.title}
                    </div>
                    <div className="text-xs text-slate-400">
                      {video.duration}s • {video.author.name}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeVideoFromPlan(planIndex)}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 