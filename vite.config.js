import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync } from 'fs';
import { resolve } from 'path';

// Copia los directorios estáticos a dist/ después del build
const EXCLUDE_FROM_COPY = [
  'Appmmpp 17AbrORIGINAL',
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
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        maestros: resolve(__dirname, 'html/Maestros/index.html'),
        centros: resolve(__dirname, 'html/Centros/index.html'),
        contactos: resolve(__dirname, 'html/Abastecimiento/contactos/contactos.html'),
        historial: resolve(__dirname, 'html/Abastecimiento/historial/index.html'),
      biomasa:   resolve(__dirname, 'html/Biomasa/index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
