import { BeatMarker, CutMarker } from '../types';

const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#F59E0B'];

interface RandomCutOptions {
  startTime: number;
  endTime: number;
  planCount: number;
  beatMarkers: BeatMarker[];
  minCutInterval: number;
  prioritizeStrongBeats: boolean;
}

interface MeasureInfo {
  startTime: number;
  bpm: number;
  confidence: number;
}

interface DropMarker extends BeatMarker {
  isDrop: boolean;
  silenceDuration: number;
}

/**
 * Détecte les mesures musicales basées sur les patterns de beats
 */
function detectMeasures(beatMarkers: BeatMarker[]): MeasureInfo[] {
  if (beatMarkers.length < 8) return [];

  // Utiliser tous les beats pour une meilleure détection du tempo
  const allBeats = beatMarkers.filter(beat => beat.intensity > 0.1);
  const strongBeats = beatMarkers.filter(beat => beat.type === 'strong');
  
  if (strongBeats.length < 3) return [];

  // Analyser les intervalles entre tous les beats pour détecter le tempo de base
  const allIntervals: number[] = [];
  for (let i = 1; i < allBeats.length; i++) {
    const interval = allBeats[i].time - allBeats[i - 1].time;
    if (interval > 0.15 && interval < 2) { // Intervalles réalistes pour des beats individuels
      allIntervals.push(interval);
    }
  }

  // Analyser les intervalles entre beats forts pour détecter les mesures
  const measureIntervals: number[] = [];
  for (let i = 1; i < strongBeats.length; i++) {
    const interval = strongBeats[i].time - strongBeats[i - 1].time;
    if (interval > 0.8 && interval < 6) { // Intervalles réalistes pour des mesures (10-75 BPM en mesures)
      measureIntervals.push(interval);
    }
  }

  if (measureIntervals.length < 2) return [];

  // Grouper les intervalles similaires pour trouver le pattern dominant
  measureIntervals.sort((a: number, b: number) => a - b);
  const clusters: number[][] = [];
  let currentCluster: number[] = [measureIntervals[0]];

  for (let i = 1; i < measureIntervals.length; i++) {
    const diff = measureIntervals[i] - measureIntervals[i - 1];
    if (diff < 0.3) { // Tolérance de 300ms pour les mesures
      currentCluster.push(measureIntervals[i]);
    } else {
      if (currentCluster.length >= 1) {
        clusters.push([...currentCluster]);
      }
      currentCluster = [measureIntervals[i]];
    }
  }
  if (currentCluster.length >= 1) {
    clusters.push(currentCluster);
  }

  // Prendre le cluster le plus fréquent
  const dominantCluster = clusters.reduce((largest, current) => 
    current.length > largest.length ? current : largest, []);

  if (dominantCluster.length < 2) return [];

  // Calculer la durée moyenne d'une mesure
  const averageMeasureDuration = dominantCluster.reduce((sum, val) => sum + val, 0) / dominantCluster.length;
  const bpm = 60 / (averageMeasureDuration / 4); // Supposer 4 temps par mesure

  // Identifier les débuts de mesure probables
  const measures: MeasureInfo[] = [];
  let expectedNextMeasure = strongBeats[0].time;

  for (const beat of strongBeats) {
    const timeDiff = Math.abs(beat.time - expectedNextMeasure);
    
    if (timeDiff < averageMeasureDuration * 0.3) { // Tolérance de 30%
      measures.push({
        startTime: beat.time,
        bpm,
        confidence: Math.max(0.1, 1 - (timeDiff / averageMeasureDuration))
      });
      expectedNextMeasure = beat.time + averageMeasureDuration;
    }
  }

  return measures.filter(m => m.confidence > 0.4); // Garder seulement les mesures confiantes
}

/**
 * Détecte les drops (beats forts après une période de silence relatif)
 */
function detectDrops(beatMarkers: BeatMarker[]): DropMarker[] {
  const drops: DropMarker[] = [];
  const minSilenceDuration = 1.2; // Minimum 1.2s de "silence" avant un drop
  const strongBeats = beatMarkers.filter(beat => beat.type === 'strong');

  for (let i = 1; i < strongBeats.length; i++) {
    const currentBeat = strongBeats[i];
    const previousBeat = strongBeats[i - 1];
    const silenceDuration = currentBeat.time - previousBeat.time;

    // Un drop est un beat fort après une longue absence de beats forts
    if (silenceDuration >= minSilenceDuration && currentBeat.intensity > 0.2) {
      drops.push({
        ...currentBeat,
        isDrop: true,
        silenceDuration
      });
    }
  }

  return drops;
}

/**
 * Génère des cuts aléatoires intelligents basés sur les beats détectés
 */
export function generateRandomCuts({
  startTime,
  endTime,
  planCount,
  beatMarkers,
  minCutInterval = 0.8,
  prioritizeStrongBeats = true
}: RandomCutOptions): CutMarker[] {
  if (planCount < 2) return [];
  
  const cutsNeeded = planCount - 1; // nombre de cuts = nombre de plans - 1
  const activeDuration = endTime - startTime;
  
  if (activeDuration < cutsNeeded * minCutInterval) {
    console.warn('Not enough duration for the requested number of cuts');
    return [];
  }

  // Filtrer les beats dans la zone active
  const availableBeats = beatMarkers.filter(beat => 
    beat.time > startTime && beat.time < endTime
  );

  if (availableBeats.length === 0) {
    return generateEquidistantCuts(startTime, endTime, cutsNeeded);
  }

  // Détecter les mesures et les drops
  const measures = detectMeasures(availableBeats);
  const drops = detectDrops(availableBeats);
  
  console.log(`🎵 Détecté ${measures.length} mesures et ${drops.length} drops`);

     // Créer une liste priorisée de positions candidates
   // Note: Les cuts sont placés légèrement AVANT les beats pour un rendu plus fluide
   const candidates: Array<BeatMarker & { priority: number; reason: string }> = [];

     // 1. PRIORITÉ ABSOLUE : Drops (toujours inclus)
   drops.forEach(drop => {
     if (drop.time > startTime && drop.time < endTime) {
       candidates.push({
         ...drop,
         time: Math.max(startTime + 0.05, drop.time - 0.05), // Cut 50ms avant le drop
         priority: 100, // Priorité maximale
         reason: 'drop'
       });
     }
   });

     // 2. PRIORITÉ HAUTE : Débuts de mesure
   measures.forEach(measure => {
     const nearestBeat = availableBeats.find(beat => 
       Math.abs(beat.time - measure.startTime) < 0.2
     );
     if (nearestBeat && !candidates.some(c => Math.abs(c.time - nearestBeat.time) < 0.1)) {
       candidates.push({
         ...nearestBeat,
         time: Math.max(startTime + 0.05, nearestBeat.time - 0.03), // Cut 30ms avant le beat
         priority: 80 + (measure.confidence * 20), // 80-100 selon confiance
         reason: 'measure_start'
       });
     }
   });

  // 3. PRIORITÉ MOYENNE : Milieux de mesure (beats forts)
  if (measures.length > 0) {
    const avgMeasureDuration = measures.length > 1 ? 
      (measures[measures.length - 1].startTime - measures[0].startTime) / (measures.length - 1) : 
      activeDuration / Math.max(1, measures.length);

    measures.forEach(measure => {
      const midMeasureTime = measure.startTime + (avgMeasureDuration / 2);
      const nearestBeat = availableBeats.find(beat => 
        Math.abs(beat.time - midMeasureTime) < avgMeasureDuration * 0.3 &&
        beat.type === 'strong'
      );
             if (nearestBeat && !candidates.some(c => Math.abs(c.time - nearestBeat.time) < 0.1)) {
         candidates.push({
           ...nearestBeat,
           time: Math.max(startTime + 0.05, nearestBeat.time - 0.03), // Cut 30ms avant le beat
           priority: 60 + (nearestBeat.intensity * 20), // 60-80
           reason: 'measure_mid'
         });
       }
    });
  }

     // 4. PRIORITÉ BASSE : Autres beats forts
   availableBeats.filter(beat => beat.type === 'strong').forEach(beat => {
     if (!candidates.some(c => Math.abs(c.time - beat.time) < 0.1)) {
       candidates.push({
         ...beat,
         time: Math.max(startTime + 0.05, beat.time - 0.02), // Cut 20ms avant le beat
         priority: 40 + (beat.intensity * 20), // 40-60
         reason: 'strong_beat'
       });
     }
   });

  // Trier par priorité décroissante
  candidates.sort((a, b) => b.priority - a.priority);

     console.log(`🎯 ${candidates.length} candidats trouvés (ajustés avant beat):`, 
     candidates.slice(0, 8).map(c => `${c.reason} @${c.time.toFixed(2)}s (${c.priority.toFixed(0)})`));

  // Sélectionner les cuts en respectant les contraintes
  const selectedCuts: CutMarker[] = [];
  const forcedCuts = candidates.filter(c => c.reason === 'drop'); // Drops obligatoires

  // D'abord, ajouter tous les drops
  forcedCuts.forEach(drop => {
    if (selectedCuts.length < cutsNeeded) {
      selectedCuts.push({
        id: crypto.randomUUID(),
        time: drop.time,
        color: COLORS[selectedCuts.length % COLORS.length],
        duration: 1
      });
    }
  });
  
  console.log(`🎤 ${forcedCuts.length} drops forcés ajoutés, ${cutsNeeded - selectedCuts.length} cuts restants à placer`);

  // Ensuite, compléter avec les autres candidats
  for (const candidate of candidates) {
    if (selectedCuts.length >= cutsNeeded) break;
    if (candidate.reason === 'drop') continue; // Déjà ajouté

    // Vérifier les conflits avec les cuts existants
    const tooClose = selectedCuts.some(cut => 
      Math.abs(cut.time - candidate.time) < minCutInterval
    );

    if (!tooClose) {
      selectedCuts.push({
        id: crypto.randomUUID(),
        time: candidate.time,
        color: COLORS[selectedCuts.length % COLORS.length],
        duration: 1
      });
    }
  }

  // Si on n'a pas assez de cuts, compléter avec l'ancienne méthode
  while (selectedCuts.length < cutsNeeded) {
    const missingIndex = selectedCuts.length;
    const idealTime = startTime + ((missingIndex + 1) * activeDuration / (cutsNeeded + 1));
    
    const nearestBeat = availableBeats
      .filter(beat => !selectedCuts.some(cut => Math.abs(cut.time - beat.time) < minCutInterval))
      .reduce((nearest, current) => {
        const currentDistance = Math.abs(current.time - idealTime);
        const nearestDistance = Math.abs(nearest.time - idealTime);
        return currentDistance < nearestDistance ? current : nearest;
      });

         if (nearestBeat) {
       selectedCuts.push({
         id: crypto.randomUUID(),
         time: Math.max(startTime + 0.05, nearestBeat.time - 0.02), // Cut 20ms avant le beat
         color: COLORS[missingIndex % COLORS.length],
         duration: 1
       });
     } else {
       selectedCuts.push({
         id: crypto.randomUUID(),
         time: idealTime, // Position calculée, pas de décalage
         color: COLORS[missingIndex % COLORS.length],
         duration: 1
       });
     }
  }

  // Optimiser les durées et trier
  const finalCuts = optimizeCutDurations(
    selectedCuts.sort((a, b) => a.time - b.time), 
    endTime
  );

     console.log(`✅ Générés ${finalCuts.length} cuts (optimisés pour fluidité):`, 
     finalCuts.map((cut, i) => `Cut ${i+1}: ${cut.time.toFixed(2)}s`));

  return finalCuts;
}

/**
 * Fallback: génère des cuts équidistants quand pas de beats disponibles
 */
function generateEquidistantCuts(startTime: number, endTime: number, count: number): CutMarker[] {
  const duration = endTime - startTime;
  const interval = duration / (count + 1);
  
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    time: startTime + (interval * (i + 1)),
    color: COLORS[i % COLORS.length],
    duration: Math.min(1, interval * 0.8)
  }));
}

/**
 * Ajoute de la variabilité aux positions pour un effet plus naturel
 */
export function addTimeVariation(cuts: CutMarker[], maxVariation: number = 0.2): CutMarker[] {
  return cuts.map(cut => ({
    ...cut,
    time: cut.time + (Math.random() - 0.5) * maxVariation
  }));
}

/**
 * Optimise les durées des cuts pour éviter les chevauchements
 */
export function optimizeCutDurations(cuts: CutMarker[], endTime: number): CutMarker[] {
  const sortedCuts = [...cuts].sort((a, b) => a.time - b.time);
  
  return sortedCuts.map((cut, index) => {
    const nextCut = sortedCuts[index + 1];
    const maxDuration = nextCut ? nextCut.time - cut.time : endTime - cut.time;
    
    return {
      ...cut,
      duration: Math.min(cut.duration, Math.max(0.3, maxDuration - 0.1))
    };
  });
} 