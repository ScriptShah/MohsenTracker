import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** Minimal vitest setup. No DOM-bound suites yet — every test in
 *  `src/lib/__tests__` runs in plain Node, which keeps the harness fast
 *  and avoids pulling jsdom into the dep tree. When/if we add component
 *  tests later, flip `environment` to 'jsdom' here and add the optional
 *  `@vitest/coverage-v8` dev-dep. The `@` alias mirrors tsconfig so
 *  imports under test resolve the same way they do in production code. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
