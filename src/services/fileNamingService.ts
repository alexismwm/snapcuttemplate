export interface ProjectSettings {
  category: string;
  templateNumber: string;
  musicId: string;
}

export interface NamingContext {
  projectSettings: ProjectSettings;
  duration: number;
  planCount: number;
}

export class FileNamingService {
  private static generateBasePrefix(context: NamingContext): string {
    const { category, templateNumber, musicId } = context.projectSettings;
    const { planCount, duration } = context;
    return `${category}_${templateNumber}_${musicId}_${planCount}_${Math.ceil(duration)}s`;
  }

  // Export JSON Project
  static generateProjectFilename(context: NamingContext): string {
    return `${this.generateBasePrefix(context)}_project.json`;
  }

  // Export Audio
  static generateMusicFilename(context: NamingContext, startTime?: number, endTime?: number, originalName?: string): string {
    const basePrefix = this.generateBasePrefix(context);
    if (startTime !== undefined && endTime !== undefined) {
      const trimStart = Math.floor(startTime);
      const trimEnd = Math.floor(endTime);
      const trimDuration = Math.ceil(endTime - startTime);
      return `${basePrefix}_music_trimmed_${trimStart}s-${trimEnd}s_${trimDuration}s.wav`;
    }
    return `${basePrefix}_music.wav`;
  }

  // Export Final Video
  static generateFinalVideoFilename(context: NamingContext, compression: 'high' | 'medium'): string {
    const basePrefix = this.generateBasePrefix(context);
    const compSuffix = compression === 'high' ? 'HD' : 'SD';
    return `${basePrefix}_render_${compSuffix}.mp4`;
  }

  // Export Thumbnails
  static generateThumbnailFilename(
    context: NamingContext, 
    size: 'large' | 'small', 
    width: number, 
    height: number, 
    format: string = 'jpeg'
  ): string {
    const basePrefix = this.generateBasePrefix(context);
    return `${basePrefix}_thumbnail_${size}_${width}x${height}.${format}`;
  }

  // Export Individual Raw Videos
  static generateRawVideoFilename(context: NamingContext, planIndex: number, originalTitle?: string): string {
    const basePrefix = this.generateBasePrefix(context);
    return `${basePrefix}_video${planIndex}.mp4`;
  }

  // Export Video Batch
  static generateVideoExportFilename(context: NamingContext, index: number): string {
    const basePrefix = this.generateBasePrefix(context);
    return `${basePrefix}_video${index + 1}.mp4`;
  }

  // Helper: Extract project settings from UI elements
  static extractSettingsFromDOM(): ProjectSettings | null {
    try {
      // Try multiple selectors to find the inputs
      const categoryInput = document.querySelector('input[placeholder="Category"], input[value*="Travel"], input[type="text"]') as HTMLInputElement;
      const templateInput = document.querySelector('input[placeholder="Template #"], input[value*="006"]') as HTMLInputElement;
      const musicInput = document.querySelector('input[placeholder="Music ID"], input[value*="012"]') as HTMLInputElement;

      // Alternative: try by parent labels or container classes
      let categoryValue = 'Travel';
      let templateValue = '006';
      let musicValue = '012';

      // Look for inputs in divs that might contain "Category", "Template", "Music"
      const allInputs = document.querySelectorAll('input[type="text"]');
      allInputs.forEach((input) => {
        const inputElement = input as HTMLInputElement;
        const parentText = inputElement.parentElement?.textContent?.toLowerCase() || '';
        const placeholder = inputElement.placeholder?.toLowerCase() || '';
        
        if (parentText.includes('category') || placeholder.includes('category')) {
          categoryValue = inputElement.value || 'Travel';
        } else if (parentText.includes('template') || placeholder.includes('template')) {
          templateValue = inputElement.value || '006';
        } else if (parentText.includes('music') || placeholder.includes('music')) {
          musicValue = inputElement.value || '012';
        }
      });

      return {
        category: categoryValue,
        templateNumber: templateValue,
        musicId: musicValue
      };
    } catch (error) {
      console.warn('Could not extract settings from DOM, using defaults:', error);
      return {
        category: 'Travel',
        templateNumber: '006',
        musicId: '012'
      };
    }
  }

  // Helper: Create naming context
  static createContext(
    projectSettings: ProjectSettings,
    cutMarkers: any[],
    duration: number
  ): NamingContext {
    return {
      projectSettings,
      duration,
      planCount: cutMarkers.length + 1
    };
  }
} 