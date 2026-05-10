import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    watch: {
      ignored: [
        '**/.smart-file-explorer-build-workspaces/**',
        '**/.smart-file-explorer-workspaces/**',
        '**/coverage/**',
        '**/dist/**',
        '**/playwright-report/**',
        '**/src-tauri/target/**',
        '**/test-results/**',
      ],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'EVAL' &&
          typeof warning.id === 'string' &&
          warning.id.includes('onnxruntime-web/dist/ort-web.min.js')
        ) {
          return;
        }

        warn(warning);
      },
      input: {
        main: path.resolve(__dirname, 'index.html'),
        spotlight: path.resolve(__dirname, 'spotlight.html'),
        trayActivity: path.resolve(__dirname, 'tray-activity.html'),
      },
    },
  },
});
