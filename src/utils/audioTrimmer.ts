/**
 * Utilitaire pour trimmer les fichiers audio selon les points IN et OUT
 */

export interface TrimOptions {
  startTime: number;
  endTime: number;
  originalFileName: string;
}

/**
 * Trim un fichier audio selon les points de temps spécifiés
 */
export async function trimAudioFile(
  audioFile: File, 
  options: TrimOptions
): Promise<Blob> {
  const { startTime, endTime } = options;
  
  // Créer un contexte audio pour le traitement
  const audioContext = new AudioContext();
  
  try {
    console.log(`🎵 Trimming audio: ${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s`);
    
    // Charger et décoder le fichier audio
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Calculer les échantillons de début et fin
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const trimmedLength = endSample - startSample;
    
    // Vérifier que les paramètres sont valides
    if (startSample >= endSample || startSample < 0 || endSample > audioBuffer.length) {
      throw new Error('Invalid trim parameters');
    }
    
    // Créer un nouveau buffer audio avec la durée tronquée
    const trimmedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      trimmedLength,
      sampleRate
    );
    
    // Copier les données audio pour chaque canal
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const originalData = audioBuffer.getChannelData(channel);
      const trimmedData = trimmedBuffer.getChannelData(channel);
      
      // Copier la partie tronquée
      for (let i = 0; i < trimmedLength; i++) {
        trimmedData[i] = originalData[startSample + i];
      }
    }
    
    // Convertir le buffer audio en WAV
    const wavBlob = await audioBufferToWav(trimmedBuffer);
    
    console.log(`✅ Audio trimé en WAV: ${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s (${(endTime - startTime).toFixed(2)}s)`);
    
    return wavBlob;
    
  } finally {
    // Nettoyer le contexte audio
    await audioContext.close();
  }
}

/**
 * Convertit un AudioBuffer en blob WAV
 */
async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // Écrire l'en-tête WAV
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Écrire les données audio
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Génère un nom de fichier pour l'audio trimé en WAV
 */
export function generateTrimmedFileName(
  originalFileName: string,
  startTime: number,
  endTime: number,
  customPrefix?: string
): string {
  const baseName = originalFileName.replace(/\.[^/.]+$/, '');
  const duration = Math.ceil(endTime - startTime);
  
  const prefix = customPrefix || baseName;
  const timeRange = `${Math.floor(startTime)}s-${Math.floor(endTime)}s`;
  
  return `${prefix}_trimmed_${timeRange}_${duration}s.wav`;
}

/**
 * Télécharge un blob audio avec le nom spécifié
 */
export function downloadAudioBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Nettoyer l'URL après un délai pour permettre le téléchargement
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
} 