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
