import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration.
// In development, API calls to /api are proxied to the Express server
// so the AI provider key is never exposed to the browser.
export default defineConfig({
  plugins: [react()],
  // Relative base so the built app works from any sub-path
  // (GitHub Pages project sites, Netlify/Vercel sub-directories).
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});