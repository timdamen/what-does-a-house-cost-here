/**
 * Lighthouse CI performance budget (docs/research/mobile-map-ux.md, decision 6).
 *
 * Runs the built Nitro server with the fixture Data Provider and audits the place-search state
 * (`/`) and the deep link that loads the map. Lighthouse's mobile defaults apply: moto g power
 * emulation, 150 ms RTT, 1.6 Mbps down, 4x CPU slowdown. Three runs per URL, median asserted.
 *
 * Resource-size budgets live in `budget.json` (Lighthouse budget format, `path` per URL, sizes in
 * kB of 1000 bytes so they equal the research figures). lhci refuses `budgetsFile` next to
 * `assertMatrix` and Lighthouse 12 dropped the `performance-budget` audit, so the file is turned
 * into `resource-summary:*:size` assertions here and merged with the timing thresholds.
 */
const budgets = require('./budget.json');

const port = Number(process.env.LHCI_PORT ?? 3113);
const origin = `http://localhost:${port}`;

const ROOT = '/$';
const DEEP_LINK = '/?lat=*';
const urls = {
  [ROOT]: `${origin}/`,
  [DEEP_LINK]: `${origin}/?lat=52.3676&lng=4.9041&r=500`,
};

/**
 * `total` transfer stays a warning until the deep-link total has settled (research decision 6).
 * `script` is a warning too: the research budget (100 kB on `/`, 280 kB on the deep link) is
 * missed by the Nuxt UI + Tailwind runtime and MapLibre (measured 151 kB / 382 kB on 2026-09-17)
 * while every timing budget passes with a 0.95+ score. The owner accepted this as good enough for
 * the MVP; tightening it is a follow-up (see ticket 13 Comments).
 */
const WARN_ONLY_RESOURCE_TYPES = new Set(['total', 'script']);

/** Same expression as lhci's budgets converter: `*` is a wildcard, a trailing `$` anchors. */
function pathToUrlPattern(path) {
  const escaped = path
    .split('*')
    .map((part) => part.replace(/([-[\]{}()*+?.,\\^|#\s])/g, '\\$1'))
    .join('.*');
  return `https?://[^/]+${escaped}`;
}

function sizeAssertions(path) {
  const budget = budgets.find((candidate) => candidate.path === path);
  if (!budget) throw new Error(`budget.json has no entry for path ${path}`);
  return Object.fromEntries(
    budget.resourceSizes.map(({ resourceType, budget: kilobytes }) => [
      `resource-summary:${resourceType}:size`,
      [
        WARN_ONLY_RESOURCE_TYPES.has(resourceType) ? 'warn' : 'error',
        { maxNumericValue: kilobytes * 1000 },
      ],
    ]),
  );
}

/** Thresholds shared by both URLs. TTI is unscored since Lighthouse 10, hence warn-only. */
const sharedAssertions = {
  'categories:performance': ['error', { minScore: 0.9 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
  'speed-index': ['warn', { maxNumericValue: 3400 }],
  interactive: ['warn', { maxNumericValue: 3800 }],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: `NUXT_DATA_PROVIDER=fixture PORT=${port} node apps/web/.output/server/index.mjs`,
      startServerReadyPattern: 'Listening on',
      startServerReadyTimeout: 30_000,
      url: Object.values(urls),
      numberOfRuns: 3,
      settings: {
        // Only the performance category is budgeted; the other categories would triple the run
        // time without adding an assertion. Device emulation and throttling stay at the defaults.
        onlyCategories: ['performance'],
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: pathToUrlPattern(ROOT),
          aggregationMethod: 'median',
          assertions: {
            ...sharedAssertions,
            'total-blocking-time': ['error', { maxNumericValue: 200 }],
            ...sizeAssertions(ROOT),
          },
        },
        {
          matchingUrlPattern: pathToUrlPattern(DEEP_LINK),
          aggregationMethod: 'median',
          assertions: {
            ...sharedAssertions,
            // Green band ends at 200 ms; the map's first paint may spend more, red starts at 600.
            'total-blocking-time': ['warn', { maxNumericValue: 200 }],
            ...sizeAssertions(DEEP_LINK),
          },
        },
        {
          // A second entry for the same URL because one audit takes one level per entry.
          matchingUrlPattern: pathToUrlPattern(DEEP_LINK),
          aggregationMethod: 'median',
          assertions: {
            'total-blocking-time': ['error', { maxNumericValue: 600 }],
          },
        },
      ],
    },
  },
};
