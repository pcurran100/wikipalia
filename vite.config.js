import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [crx({ manifest })],
  publicDir: 'public',
  build: {
    target: ['chrome112'],
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        dashboard: resolve(__dirname, 'src/dashboard/index.html'),
        background: resolve(__dirname, 'background.js'),
        content: resolve(__dirname, 'content.js')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
