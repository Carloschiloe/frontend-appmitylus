import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync } from 'fs';
import { resolve } from 'path';

// Copia los directorios estáticos a dist/ después del build
const EXCLUDE_FROM_COPY = [
  'Appmmpp 12Abr',
  '.git',
  'node_modules',
];

const copyStaticAssets = {
  name: 'copy-static-assets',
  closeBundle() {
    for (const dir of ['html', 'css', 'js']) {
      if (existsSync(dir)) {
        cpSync(dir, `dist/${dir}`, {
          recursive: true,
          filter: (src) => !EXCLUDE_FROM_COPY.some((ex) => src.includes(ex)),
        });
      }
    }
  },
};

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    copyStaticAssets,
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: true,
    cssMinify: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — cambia muy raramente, cache-able
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Tanstack — separado para invalidar solo cuando se actualiza
          'vendor-query': ['@tanstack/react-query'],
          // Lucide icons — gran superficie, se cachea sola
          'vendor-lucide': ['lucide-react'],
          // Mapa pesado de vista especifica.
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
