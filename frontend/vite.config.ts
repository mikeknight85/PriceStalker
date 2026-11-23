import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

/*
 * The frontend's own version, baked in at build time (issue: show the running
 * version in the menu).
 *
 * The backend reports its version separately at runtime. Both are shown when
 * they disagree, because frontend and backend ship as separate images and a
 * partial deploy is exactly the situation where a version line earns its place.
 */
const packageVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
).version as string;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
  },
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  server: {
    port: Number(process.env.VITE_PORT || 8080),
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/routeTree.gen.ts'],
    },
  },
});
