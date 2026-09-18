# 13 Performance budget in CI

Status: done
Type: task
Blocked by: 01, 09, 10

## Goal

User stories 39, 43; spec section "Performance".

## Scope

- `lighthouserc.cjs` using `@lhci/cli` with the thresholds from `docs/research/mobile-map-ux.md` (mobile preset, simulated 4G, mid-range CPU throttling), asserting performance score, LCP, TBT and total JS bytes, run against `pnpm build` + `node .output/server/index.mjs` with `NUXT_DATA_PROVIDER=fixture` on the URL `/?lat=…&lng=…&r=…` of the fixture town.
- Budget file (`budget.json`) for resource sizes so initial JS stays well under MapLibre's own size.
- CI job `lighthouse` in `.github/workflows/ci.yml` that fails the build on assertion failure; root script `pnpm lighthouse`.
- Verify locally that the built app passes; if it does not, fix the cause (lazy map, font subsetting, icon bundling) in this ticket.
- Long cache headers for static assets and self-hosted fonts confirmed (`nitro.routeRules`).

## Acceptance

- `pnpm lighthouse` passes locally against the fixture build and the numbers are recorded in this ticket's Comments.

## Updates after research (ticket 01)

Use the exact thresholds and assertion syntax from `docs/research/mobile-map-ux.md` decision 6 (score ≥ 0.9, LCP ≤ 2500 ms, TBT ≤ 200 ms on `/` and warn 200 / error 600 ms on the deep link, CLS ≤ 0.1, warn-only FCP/SI/TTI, `resource-summary:script:size` ≤ 100000 B on `/` and ≤ 280000 B on the deep link, total warn 300 kB / 1.5 MB, 3 runs median). Test both `/` and `/?lat=52.3676&lng=4.9041&r=500`.

## Deviations

- `resource-summary:script:size` is asserted at the research values but as `warn`, not `error`. Measured medians on 2026-09-17 are 151 kB on `/` and 382 kB on the deep link against budgets of 100 kB and 280 kB. All timing budgets and the score pass. The owner decided the performance is good enough for the MVP; making the script budget an error again (by trimming the Nuxt UI/Tailwind runtime or splitting the map chunk further) is a follow-up.

## Comments

- Median of 3 Lighthouse 13 mobile runs against the built app with the fixture provider (2026-09-17):

  | URL | Score | LCP | TBT | CLS | FCP | TTI | Script bytes | Total bytes |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | `/` | 0.96 | 2256 ms | 14 ms | 0.002 | 2256 ms | 2344 ms | 150,894 | 191,882 |
  | `/?lat=52.3676&lng=4.9041&r=500` | 0.95 | 2410 ms | 48 ms | 0 | 2328 ms | 4339 ms | 381,542 | 709,045 |

- Changes made to pass: the map placeholder moved from `HouseMap.client.vue` into `HouseMapFrame.vue` so the server-rendered placeholder survives hydration and stays the LCP candidate (otherwise Chrome attributed LCP to the re-created copy after the map chunk loaded); the map reports `placeholder` state upward and exposes `retry()`. Long immutable cache headers for `/_nuxt/**` and `/_fonts/**` added in `nuxt.config.ts`. `@lhci/cli` added at the root; `pnpm lighthouse` builds and runs `lhci autorun`; CI job `lighthouse` uploads `.lighthouseci` on failure.
- The agent implementing this ticket was stopped mid-iteration by the maintainer after the numbers above were reached; the remaining work (script budget) is recorded under Deviations.
