/**
 * Utilitaire pour détecter SharedArrayBuffer et diagnostiquer les problèmes CORS
 */

export interface SharedArrayBufferStatus {
  available: boolean;
  reason: string;
  suggestions: string[];
}

/**
 * Détecte si SharedArrayBuffer est disponible et pourquoi
 */
export function detectSharedArrayBuffer(): SharedArrayBufferStatus {
  // Vérifier si SharedArrayBuffer existe
  if (typeof SharedArrayBuffer === 'undefined') {
    return {
      available: false,
      reason: 'SharedArrayBuffer not supported by browser',
      suggestions: [
        'Use a modern browser (Chrome 68+, Firefox 79+, Safari 15.2+)',
        'Ensure you are on HTTPS (required for SharedArrayBuffer)'
      ]
    };
  }

  // Tester si SharedArrayBuffer peut être instancié
  try {
    new SharedArrayBuffer(1);
    return {
      available: true,
      reason: 'SharedArrayBuffer is fully available',
      suggestions: ['FFmpeg.js should work correctly']
    };
  } catch (error) {
    // SharedArrayBuffer existe mais ne peut pas être utilisé
    // Cela indique généralement un problème de headers CORS
    return {
      available: false,
      reason: 'SharedArrayBuffer blocked by CORS policy',
      suggestions: [
        'Check that Cross-Origin-Opener-Policy: same-origin header is set',
        'Check that Cross-Origin-Embedder-Policy: require-corp or credentialless header is set',
        'Verify headers in DevTools -> Network -> HTML response -> Headers',
        'Clear Netlify cache and redeploy if headers were recently added'
      ]
    };
  }
}

/**
 * Affiche les informations de diagnostic dans la console
 */
export function logSharedArrayBufferDiagnostic(): SharedArrayBufferStatus {
  const status = detectSharedArrayBuffer();
  
  console.group('🔍 SharedArrayBuffer Diagnostic');
  console.log('Available:', status.available);
  console.log('Reason:', status.reason);
  console.log('Suggestions:');
  status.suggestions.forEach((suggestion, index) => {
    console.log(`  ${index + 1}. ${suggestion}`);
  });
  console.groupEnd();
  
  return status;
}

/**
 * Headers CORS recommandés pour FFmpeg.js
 */
export const RECOMMENDED_CORS_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless' // Moins restrictif que require-corp
};

/**
 * URL pour tester les headers CORS
 */
export function generateHeadersTestUrl(domain: string): string {
  return `https://webcorstest.com/scan/${domain}`;
} 