import { defineConfig } from 'vitest/config';

/**
 * End-to-end tests. They build and boot the app through `setup()` from `@nuxt/test-utils/e2e`
 * and drive it with Playwright, so they need a plain Vitest config rather than the Nuxt runtime
 * environment used by `vitest.config.ts`. Run with `pnpm --filter @house-cost/web test:e2e`.
 * Populated by later tickets.
 */
export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
