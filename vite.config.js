import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync, existsSync } from 'fs';

// Copia los directorios estáticos a dist/ después del build
// para que Vercel los sirva correctamente
const copyStaticAssets = {
  name: 'copy-static-assets',
  closeBundle() {
    for (const dir of ['html', 'css', 'js']) {
      if (existsSync(dir)) {
        cpSync(dir, `dist/${dir}`, { recursive: true });
      }
    }
  },
};

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic',
    }),
    tailwindcss(),
    copyStaticAssets,
  ],
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
