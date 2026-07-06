import { defineConfig } from 'vitest/config';

// Solo módulos puros (lib/coach sin react-native). La UI se verifica con tsc + E2E.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
