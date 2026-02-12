/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          ui: ['@headlessui/react', '@heroicons/react'],
          vendor: ['axios', 'react', 'react-dom'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/ocr': {
        target: 'http://127.0.0.1:18001',
        changeOrigin: true,
        rewrite: (value) => value.replace(/^\/api\/ocr/, '/ocr'),
      },
      '/api/rag': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
        rewrite: (value) => value.replace(/^\/api\/rag/, '/api'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
