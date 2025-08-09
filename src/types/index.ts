export interface AudioFile {
  file: File;
  url: string;
  duration: number;
  name: string;
}

export interface BeatMarker {
  time: number;
  intensity: number;
  type: 'strong' | 'medium' | 'weak';
}

export interface CutMarker {
  id: string;
  time: number;
  color: string;
  duration: number;
  // videoId retiré - pas dans le template JSON brut
  trimSettings?: {
    startTime: number;
    endTime: number;
  };
}

export interface PlanVideoAssignment {
  planIndex: number; // 1, 2, 3, etc.
  videoId: string;
  cutMarkerId?: string; // Si assigné à un cut spécifique
}

export interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  zoom: number;
  startTime: number;
  endTime: number;
}

export interface SnapcutClip {
  duration: number;
  kind: {
    clip: Record<string, never>;
  };
  clip: {
    backgroundBlurEnabled: boolean;
    contentRotation: number;
    color: [number, number, number, number];
    name: string;
    rotation: [number, number, number];
    animationStartScale: [number, number, number];
    isAnimated: boolean;
    opacity: number;
    blend: {
      none: Record<string, never>;
    };
    backgroundColor: [number, number, number, number];
    position: [number, number];
    animationStartRotation: [number, number, number];
    animationEndScale: [number, number, number];
    scale: [number, number, number];
    duration: number;
    animationEndRotation: [number, number, number];
    kind: {
      empty: Record<string, never>;
    };
    animationStartPosition: [number, number];
    colorAdjustment: {
      contrast: number;
      temperature: number;
      hue: number;
      saturation: number;
      sharpness: number;
      exposure: number;
    };
    aspect: {
      aspectFit: Record<string, never>;
    };
    animationEndPosition: [number, number];
  };
  startTime: number;
}

export interface SnapcutAudio {
  startTime: number;
  isMuted: boolean;
  fileName: string;
  fileTrimStart: number;
  duration: number;
  gain: number;
  playbackSpeed: number;
}

export interface SnapcutExport {
  id: string;
  title: string;
  lastModificationDate: number;
  editionProject: {
    mainTimeline: any[];
    aspectRatio: {
      tiktok?: Record<string, never>;
      r_9_16?: Record<string, never>;
    };
    superpositionTimeline: any[];
    audioTimeline: SnapcutAudio[];
  };
}