import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

// Update paths in manifest for source files
const devManifest = structuredClone(manifest);
devManifest.background.service_worker = 'src/background.js';
devManifest.content_scripts[0].js = ['src/content.js'];
devManifest.action.default_popup = 'src/popup.html';
if (devManifest.web_accessible_resources && devManifest.web_accessible_resources.length) {
  devManifest.web_accessible_resources[0].resources = [
    'src/dashboard/index.html',
    'src/styles.css'
  ];
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [crx({ manifest })],
  publicDir: 'public',
  build: {
    target: ['chrome112'],
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
