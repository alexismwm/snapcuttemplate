import { VideoTheme, ThemeConfig } from '../types/video';

/**
 * Configuration des thèmes vidéo disponibles
 */
export const VIDEO_THEMES: Record<VideoTheme, ThemeConfig> = {
  travel: {
    id: 'travel',
    name: 'Travel',
    description: 'Landscapes, cities, adventures',
    keywords: ['travel', 'vacation', 'landscape', 'city', 'adventure', 'tourism'],
    color: '#3B82F6', // Blue
    icon: '✈️'
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'Professional, meetings, corporate',
    keywords: ['business', 'office', 'meeting', 'corporate', 'professional', 'team'],
    color: '#1F2937', // Dark gray
    icon: '💼'
  },
  lifestyle: {
    id: 'lifestyle',
    name: 'Lifestyle',
    description: 'People, family, everyday life',
    keywords: ['lifestyle', 'people', 'family', 'home', 'everyday', 'casual'],
    color: '#F59E0B', // Amber
    icon: '🏠'
  },
  nature: {
    id: 'nature',
    name: 'Nature',
    description: 'Forests, oceans, wildlife',
    keywords: ['nature', 'forest', 'ocean', 'mountains', 'wildlife', 'outdoor'],
    color: '#10B981', // Emerald
    icon: '🌿'
  },
  sports: {
    id: 'sports',
    name: 'Sports',
    description: 'Fitness, athletics, competition',
    keywords: ['sports', 'fitness', 'exercise', 'athletic', 'competition', 'training'],
    color: '#EF4444', // Red
    icon: '⚽'
  },
  food: {
    id: 'food',
    name: 'Food',
    description: 'Cooking, restaurants, meals',
    keywords: ['food', 'cooking', 'restaurant', 'meal', 'kitchen', 'dining'],
    color: '#F97316', // Orange
    icon: '🍴'
  },
  fashion: {
    id: 'fashion',
    name: 'Fashion',
    description: 'Style, clothing, beauty',
    keywords: ['fashion', 'style', 'clothing', 'model', 'beauty', 'trendy'],
    color: '#EC4899', // Pink
    icon: '👗'
  },
  technology: {
    id: 'technology',
    name: 'Technology',
    description: 'Digital, innovation, modern',
    keywords: ['technology', 'digital', 'computer', 'innovation', 'tech', 'modern'],
    color: '#8B5CF6', // Purple
    icon: '💻'
  },
  architecture: {
    id: 'architecture',
    name: 'Architecture',
    description: 'Buildings, design, urban',
    keywords: ['architecture', 'building', 'construction', 'modern', 'design', 'urban'],
    color: '#6B7280', // Gray
    icon: '🏢'
  },
  abstract: {
    id: 'abstract',
    name: 'Abstract',
    description: 'Patterns, geometric, artistic',
    keywords: ['abstract', 'pattern', 'geometric', 'artistic', 'creative', 'minimal'],
    color: '#14B8A6', // Teal
    icon: '🎨'
  }
};

/**
 * Obtient la liste des thèmes triés par popularité
 */
export function getPopularThemes(): ThemeConfig[] {
  // Ordre de popularité basé sur l'usage habituel
  const popularOrder: VideoTheme[] = [
    'travel',
    'lifestyle', 
    'business',
    'nature',
    'food',
    'sports',
    'fashion',
    'technology',
    'architecture',
    'abstract'
  ];

  return popularOrder.map(theme => VIDEO_THEMES[theme]);
}

/**
 * Obtient un thème par son ID
 */
export function getThemeById(id: VideoTheme): ThemeConfig {
  return VIDEO_THEMES[id];
}

/**
 * Recherche de thèmes par mot-clé
 */
export function searchThemes(query: string): ThemeConfig[] {
  const lowerQuery = query.toLowerCase();
  
  return Object.values(VIDEO_THEMES).filter(theme => 
    theme.name.toLowerCase().includes(lowerQuery) ||
    theme.description.toLowerCase().includes(lowerQuery) ||
    theme.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery))
  );
} 