import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: true,
    include: ['tests/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    exclude: ['**/*.e2e.spec.ts', 'node_modules/**', 'dist/**'],
  },
});
