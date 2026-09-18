# 11 Wire the open-data provider into the app

Status: ready-for-agent
Type: task
Blocked by: 04, 05, 06

## Goal

Make production use real open data. User story 42.

## Scope

- `server/utils/provider.ts`: `open-data` branch creates `createOpenDataProvider` and `createNominatimGeocoder` from `@house-cost/open-data` with `userAgent` from runtime config (default `what-does-a-house-cost-here/<version> (+https://github.com/timdamen/what-does-a-house-cost-here)`) and a concurrency limit of 2. Singleton per server instance.
- `.env.example` documenting `NUXT_DATA_PROVIDER`, `NUXT_USER_AGENT`, `NUXT_PUBLIC_MAP_STYLE_LIGHT`, `NUXT_PUBLIC_MAP_STYLE_DARK`.
- A one-off manual smoke check with `NUXT_DATA_PROVIDER=open-data pnpm dev` against a real Location in England (for GB prices) and one elsewhere (no-data path); record the two URLs you used in this ticket's Comments.
- No change to tests (they stay on the fixture provider).

## Acceptance

- Manual smoke check done and noted. `pnpm quality` green.
