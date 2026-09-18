import { defineVitestConfig } from '@nuxt/test-utils/config';

/**
 * Unit and component tests. They run inside a Nuxt runtime environment (happy-dom) so
 * auto-imports, plugins and runtime config behave as they do in the app.
 * End-to-end tests live in `vitest.e2e.config.ts`.
 */
export default defineVitestConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
      },
    },
  },
});
