import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
    proxy: {
      '/live/pool': {
        target: 'https://pool.zionterranova.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/live\/pool/, ''),
      },
      '/live/oasis': {
        target: 'https://oasis.zionterranova.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/live\/oasis/, ''),
      },
      '/live/app': {
        target: 'https://app.zionterranova.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/live\/app/, ''),
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
  },
});
