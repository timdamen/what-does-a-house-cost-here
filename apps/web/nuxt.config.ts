import { version } from './package.json';

/** Identifies this deployment to the open-data services (Nominatim requires it). */
const defaultUserAgent = `what-does-a-house-cost-here/${version} (+https://github.com/timdamen/what-does-a-house-cost-here)`;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-17',

  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/image', '@nuxt/fonts', '@nuxt/icon', '@nuxt/test-utils/module'],

  css: ['~/assets/css/main.css'],

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
    },
  },

  icon: {
    serverBundle: {
      collections: ['lucide'],
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
