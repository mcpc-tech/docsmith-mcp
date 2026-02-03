import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'ui',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: '../dist/ui',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'ui/index.html'),
      output: {
        entryFileNames: 'viewer.js',
      },
    },
  },
});
