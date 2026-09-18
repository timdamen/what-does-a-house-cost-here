# 13 Performance budget in CI

Status: ready-for-agent
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
