
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_VERSION = 'v3.3.0';
const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_NUMBER = `${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(new Date().getDate()).padStart(2, '0')}.${String(new Date().getHours()).padStart(2, '0')}${String(new Date().getMinutes()).padStart(2, '0')}`;
const BUILD_ID = `build-${Date.now().toString(36)}`;

function versionPlugin(): Plugin {
  return {
    name: 'version-metadata-generator',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: APP_VERSION,
          buildNumber: BUILD_NUMBER,
          buildTimestamp: BUILD_TIMESTAMP,
          buildId: BUILD_ID,
          environment: 'production'
        }, null, 2)
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Access-Control-Allow-Origin': '*',
        },
      },
      plugins: [react(), tailwindcss(), versionPlugin()],
      assetsInclude: ['**/*.svga', '**/*.proto', '**/*.wasm'],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__APP_VERSION__': JSON.stringify(APP_VERSION),
        '__BUILD_TIMESTAMP__': JSON.stringify(BUILD_TIMESTAMP),
        '__BUILD_NUMBER__': JSON.stringify(BUILD_NUMBER),
        '__BUILD_ID__': JSON.stringify(BUILD_ID),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('@ffmpeg')) return 'ffmpeg-vendor';
                if (id.includes('firebase')) return 'firebase-vendor';
                if (id.includes('lucide-react')) return 'lucide-vendor';
                if (id.includes('lottie-web') || id.includes('svga.lite') || id.includes('libpag')) return 'animation-vendor';
                if (id.includes('react') || id.includes('react-dom') || id.includes('motion')) return 'react-vendor';
                if (id.includes('pdfjs-dist') || id.includes('jspdf')) return 'pdf-vendor';
                if (id.includes('@breezystack') || id.includes('wavesurfer.js')) return 'audio-vendor';
                if (id.includes('@mediapipe')) return 'mediapipe-vendor';
                return 'vendor';
              }
            }
          }
        }
      }
    };
});

