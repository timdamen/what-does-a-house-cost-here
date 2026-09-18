import { fileURLToPath } from 'node:url';
import { version } from './package.json';

/** Identifies this deployment to the open-data services (Nominatim requires it). */
const defaultUserAgent = `what-does-a-house-cost-here/${version} (+https://github.com/timdamen/what-does-a-house-cost-here)`;

/**
 * True on Vercel (the platform and `vercel build` set `VERCEL=1`, which also makes Nitro pick its
 * `vercel` preset) and for an explicit `NITRO_PRESET=vercel` build. Vercel's project root is the
 * repository root (`vercel.json` there), and Vercel looks for the Build Output API directory at
 * `<project root>/.vercel/output`, while Nitro's preset writes it next to this app. Redirect it.
 */
const buildingForVercel = Boolean(process.env.VERCEL) || process.env.NITRO_PRESET === 'vercel';
const vercelOutputDir = fileURLToPath(new URL('../../.vercel/output', import.meta.url));

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-17',

  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/image', '@nuxt/fonts', '@nuxt/icon', '@nuxt/test-utils/module'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      // `viewport-fit=cover` lets the header and the bottom sheet pad for the notch and home bar
      // with `env(safe-area-inset-*)`.
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
    },
  },

  runtimeConfig: {
    // Which Data Provider the server routes use: `open-data` in production, `fixture` in dev and
    // test. Overridden by NUXT_DATA_PROVIDER (see `.env.example`).
    dataProvider: process.env.NODE_ENV === 'production' ? 'open-data' : 'fixture',
    // User-Agent sent on every upstream open-data request. Overridden by NUXT_USER_AGENT.
    userAgent: defaultUserAgent,
    public: {
      // MapLibre style URLs. Overridden by NUXT_PUBLIC_MAP_STYLE_LIGHT / _DARK.
      mapStyleLight: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
      mapStyleDark: 'https://tiles.versatiles.org/assets/styles/eclipse/style.json',
      // Installs `window.__houseMap` outside dev builds so browser tests can drive the map.
      // Overridden by NUXT_PUBLIC_TEST_HOOKS=true.
      testHooks: false,
    },
  },

  icon: {
    serverBundle: {
      collections: ['lucide'],
    },
  },

  nitro: {
    // Pre-compress `.output/public` (brotli and gzip) so the node server sends `_nuxt` assets
    // compressed; the Lighthouse budgets in `budget.json` are transfer sizes.
    compressPublicAssets: true,
    ...(buildingForVercel ? { output: { dir: vercelOutputDir } } : {}),
    vercel: {
      // Written to the server function's `.vc-config.json`. Cold Overpass-bound routes take
      // 2-5.5 s (ticket 11), so the function needs well over Vercel's 10 s default; the runtime
      // matches `.nvmrc` (Nitro 2.13 would otherwise fall back to `nodejs22.x`).
      functions: { maxDuration: 30, runtime: 'nodejs24.x' },
    },
  },

  hooks: {
    'build:manifest'(manifest) {
      // Research decision 7: MapLibre is fetched on demand once a Location is known. Without
      // this the renderer prefetches its 1 MB chunk on every page, including the place-search
      // state that never shows a map.
      for (const [key, entry] of Object.entries(manifest)) {
        if (key.includes('maplibre-gl')) entry.prefetch = false;
      }
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  vite: {
    optimizeDeps: {
      // maplibre-gl spawns its worker from a sibling file that Vite's pre-bundler does not
      // copy, so the map never loads in dev unless the package is left unoptimised.
      exclude: ['maplibre-gl'],
    },
  },
});
