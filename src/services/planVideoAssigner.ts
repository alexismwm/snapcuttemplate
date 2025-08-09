import { VideoAsset, VideoTheme } from '../types/video';
import { CutMarker, PlanVideoAssignment } from '../types';
import { videoService } from './videoService';

/**
 * Service pour assigner automatiquement des vidéos aux plans
 */
class PlanVideoAssigner {
  private currentAssignments: Map<number, VideoAsset> = new Map();
  private availableVideos: VideoAsset[] = [];
  private currentTheme: VideoTheme = 'travel';

  /**
   * Assigne automatiquement des vidéos aux plans selon le thème
   */
  async assignVideosToPlans(
    cutMarkers: CutMarker[],
    theme: VideoTheme,
    forceReassign = false,
    customKeywords?: string[]
  ): Promise<Map<number, VideoAsset>> {
    
    // Si même thème et pas de force reassign, retourner les assignations existantes
    if (this.currentTheme === theme && !forceReassign && this.currentAssignments.size > 0) {
      return this.currentAssignments;
    }

    this.currentTheme = theme;
    
    try {
      // Charger les vidéos pour le thème
      const keywordInfo = customKeywords && customKeywords.length > 0 
        ? ` with keywords: [${customKeywords.join(', ')}]` 
        : '';
      console.log(`🎬 Loading videos for theme "${theme}"${keywordInfo}`);
      this.availableVideos = await videoService.getVideosByTheme(theme, false, customKeywords);
      
      if (this.availableVideos.length === 0) {
        console.warn(`No videos available for theme "${theme}"`);
        return this.currentAssignments;
      }

      // Calculer le nombre de plans
      const planCount = cutMarkers.length + 1;
      
      // Nettoyer les anciennes assignations
      this.currentAssignments.clear();

      // Assigner des vidéos de manière intelligente
      for (let planIndex = 1; planIndex <= planCount; planIndex++) {
        const video = this.selectVideoForPlan(planIndex, planCount);
        if (video) {
          this.currentAssignments.set(planIndex, video);
        }
      }

      console.log(`✅ Assigned videos to ${this.currentAssignments.size} plans`);
      return this.currentAssignments;

    } catch (error) {
      console.error('Failed to assign videos to plans:', error);
      return this.currentAssignments;
    }
  }

  /**
   * Sélectionne intelligemment une vidéo pour un plan donné
   */
  private selectVideoForPlan(planIndex: number, totalPlans: number): VideoAsset | null {
    if (this.availableVideos.length === 0) return null;

    // Stratégies de sélection selon la position du plan
    const strategies = {
      // Premier plan : vidéo impactante
      first: () => this.availableVideos.find(v => 
        v.tags.some(tag => ['travel', 'landscape', 'adventure', 'city'].includes(tag.toLowerCase()))
      ) || this.availableVideos[0],

      // Plan du milieu : vidéo d'action/transition
      middle: () => this.availableVideos.find(v => 
        v.tags.some(tag => ['action', 'movement', 'dynamic', 'people'].includes(tag.toLowerCase()))
      ) || this.availableVideos[Math.floor(this.availableVideos.length / 2)],

      // Dernier plan : vidéo de conclusion
      last: () => this.availableVideos.find(v => 
        v.tags.some(tag => ['sunset', 'peaceful', 'ending', 'beautiful'].includes(tag.toLowerCase()))
      ) || this.availableVideos[this.availableVideos.length - 1],

      // Plans intermédiaires : rotation équilibrée
      intermediate: (index: number) => {
        const videoIndex = (index - 1) % this.availableVideos.length;
        return this.availableVideos[videoIndex];
      }
    };

    // Appliquer la stratégie appropriée
    if (planIndex === 1) {
      return strategies.first();
    } else if (planIndex === totalPlans && totalPlans > 2) {
      return strategies.last();
    } else if (totalPlans > 4 && planIndex === Math.ceil(totalPlans / 2)) {
      return strategies.middle();
    } else {
      return strategies.intermediate(planIndex);
    }
  }

  /**
   * Obtient la vidéo assignée à un plan
   */
  getVideoForPlan(planIndex: number): VideoAsset | null {
    return this.currentAssignments.get(planIndex) || null;
  }

  /**
   * Obtient toutes les assignations actuelles
   */
  getAllAssignments(): Map<number, VideoAsset> {
    return new Map(this.currentAssignments);
  }

  /**
   * Obtient les métadonnées des assignations
   */
  getAssignmentStats() {
    return {
      totalPlans: this.currentAssignments.size,
      currentTheme: this.currentTheme,
      availableVideos: this.availableVideos.length,
      assignments: Array.from(this.currentAssignments.entries()).map(([plan, video]) => ({
        planIndex: plan,
        videoTitle: video.title,
        videoId: video.id,
        videoDuration: Math.round(video.duration),
        videoTags: video.tags.slice(0, 3)
      }))
    };
  }

  /**
   * Réassigne une vidéo spécifique à un plan
   */
  reassignVideoToPlan(planIndex: number, videoId: string): boolean {
    const video = this.availableVideos.find(v => v.id === videoId);
    if (video) {
      this.currentAssignments.set(planIndex, video);
      console.log(`🔄 Reassigned plan ${planIndex} to video "${video.title}"`);
      return true;
    }
    return false;
  }

  /**
   * Mélange aléatoirement les assignations
   */
  shuffleAssignments(): Map<number, VideoAsset> {
    if (this.availableVideos.length === 0) return this.currentAssignments;

    const planIndexes = Array.from(this.currentAssignments.keys());
    const shuffledVideos = [...this.availableVideos].sort(() => Math.random() - 0.5);

    planIndexes.forEach((planIndex, i) => {
      const video = shuffledVideos[i % shuffledVideos.length];
      this.currentAssignments.set(planIndex, video);
    });

    console.log('🎲 Shuffled video assignments');
    return this.currentAssignments;
  }

  /**
   * Nettoie les assignations
   */
  clearAssignments(): void {
    this.currentAssignments.clear();
    this.availableVideos = [];
    console.log('🗑️ Cleared video assignments');
  }

  /**
   * Obtient les vidéos disponibles pour le thème actuel
   */
  getAvailableVideos(): VideoAsset[] {
    return [...this.availableVideos];
  }

  /**
   * Prévisualise l'assignation sans l'appliquer
   */
  previewAssignment(cutMarkers: CutMarker[], theme: VideoTheme): {
    planCount: number;
    availableVideos: number;
    previewAssignments: Array<{ planIndex: number; videoTitle: string; }>
  } {
    const planCount = cutMarkers.length + 1;
    const availableCount = this.availableVideos.length;
    
    const preview = [];
    for (let i = 1; i <= Math.min(planCount, 5); i++) { // Preview max 5 plans
      const video = this.selectVideoForPlan(i, planCount);
      preview.push({
        planIndex: i,
        videoTitle: video?.title || 'No video available'
      });
    }

    return {
      planCount,
      availableVideos: availableCount,
      previewAssignments: preview
    };
  }
}

// Instance singleton
export const planVideoAssigner = new PlanVideoAssigner();
export default planVideoAssigner; 