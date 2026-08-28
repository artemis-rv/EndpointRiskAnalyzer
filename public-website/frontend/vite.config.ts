/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite configuration.
 *
 * Notes:
 * - Dev server is pinned to port 3000 because the FastAPI backend's
 *   CORS_ORIGINS allowlist contains http://localhost:3000. Changing this port
 *   requires a matching backend CORS change.
 * - No API base URL is hardcoded anywhere; it comes from VITE_API_BASE_URL.
 * - Source maps are disabled for production builds so internal module paths are
 *   not shipped to browsers (A05: security misconfiguration).
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split vendor code so the public marketing pages do not pay for the
        // full router/query runtime on first paint more than once.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'router-vendor';
          if (id.includes('@tanstack')) return 'query-vendor';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
  define: {
    __APP_MODE__: JSON.stringify(mode),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['src/test/**', '**/*.d.ts', 'src/main.tsx'],
    },
  },
}));
