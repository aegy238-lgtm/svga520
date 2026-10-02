
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

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
        hmr: false,
        headers: {
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Access-Control-Allow-Origin': '*',
        },
      },
      plugins: [
        react(), 
        tailwindcss(), 
        versionPlugin(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'sw-share-target.js'],
          manifest: false,
          injectRegister: null,
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            importScripts: ['/sw-share-target.js'],
            navigateFallback: '/index.html'
          },
          devOptions: {
            enabled: false
          }
        })
      ],
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
        },
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
      },
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-dom/client',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'lucide-react'
        ]
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild',
        cssMinify: true,
        target: 'es2020',
        chunkSizeWarningLimit: 1800,
        rollupOptions: {
          treeshake: true,
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('jspdf') || id.includes('pdf-lib') || id.includes('pdfjs-dist')) {
                  return 'vendor-pdf';
                }
                if (id.includes('@ffmpeg') || id.includes('fluent-ffmpeg')) {
                  return 'vendor-ffmpeg';
                }
                if (id.includes('libpag')) {
                  return 'vendor-libpag';
                }
                if (id.includes('firebase')) {
                  return 'vendor-firebase';
                }
                if (id.includes('lucide-react')) {
                  return 'vendor-icons';
                }
                if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react-router/')) {
                  return 'vendor-react';
                }
                if (id.includes('pako') || id.includes('jszip') || id.includes('fflate')) {
                  return 'vendor-compression';
                }
              }
            }
          }
        }
      }
    };
});

