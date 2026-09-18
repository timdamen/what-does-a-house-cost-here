// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-17',

  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxt/image',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/scripts',
    '@nuxt/test-utils/module',
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Which Data Provider the server routes use. Overridden by NUXT_DATA_PROVIDER.
    dataProvider: process.env.NODE_ENV === 'production' ? 'open-data' : 'fixture',
    // User-Agent sent on every upstream open-data request. Overridden by NUXT_USER_AGENT.
    userAgent: 'house-cost-here (https://github.com/timdamen/what-does-a-house-cost-here)',
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
});
