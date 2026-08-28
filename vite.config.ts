
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
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Opener-Policy': 'same-origin',
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
        sourcemap: false
      }
    };
});

