import { defineConfig } from 'vitest/config';

/**
 * End-to-end tests. They build and boot the app through `setup()` from `@nuxt/test-utils/e2e`
 * and drive it with Playwright, so they need a plain Vitest config rather than the Nuxt runtime
 * environment used by `vitest.config.ts`. Run with `pnpm test:e2e` at the root. `api*.test.ts`
 * call the server routes; `browser.test.ts` drives the built app in headless Chromium at a phone
 * viewport (Playwright's Chromium must be installed: `pnpm exec playwright install chromium`).
 */
export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
