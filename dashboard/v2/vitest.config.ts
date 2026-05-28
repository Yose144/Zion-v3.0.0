import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e', 'test-results'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/', 'e2e/'],
    },
  },
});
