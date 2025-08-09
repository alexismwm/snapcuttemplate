import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Optimizations
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  
  // Build configuration
  build: {
    // Enable source maps for debugging
    sourcemap: true,
    
    // Optimize chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'lucide': ['lucide-react'],
          'utils': ['./src/utils/randomCutGenerator.ts']
        }
      }
    },
    
    // Asset handling
    assetsDir: 'assets',
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    }
  },
  
  // Server configuration for development
  server: {
    port: 5173,
    host: true, // Allow external connections
    open: true // Auto-open browser
  },
  
  // Preview configuration
  preview: {
    port: 4173,
    host: true
  }
});
