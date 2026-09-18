# 05 Server routes and caching

Status: ready-for-agent
Type: task
Blocked by: 03

## Goal

Spec section "Server routes and caching"; user stories 9, 40, 41, 42. Build the Nuxt server layer against the fixture provider (ticket 11 wires the open-data provider).

## Scope

- `apps/web/server/utils/provider.ts`: `useDataProvider(event)` and `useGeocoder(event)` returning the provider chosen by runtime config `dataProvider`. Only `fixture` is available in this ticket; `open-data` throws a clear "not wired yet" error that ticket 11 replaces.
- Routes from `00-README.md`: `GET /api/houses`, `GET /api/facts`, `POST /api/prices`, `GET /api/geocode`. Validate query/body with zod; round coordinates to 4 decimals before anything else; never log or store raw coordinates.
- Caching with Nitro `defineCachedEventHandler` (or `cachedFunction`) keyed on rounded lat, lng, radius: houses and facts `maxAge` 6 hours, prices 24 hours, geocode 24 hours. Set `Cache-Control: public, max-age=…` headers to match so the browser cache helps too.
- Response envelope: `{ data, provenance, cap?, truncated? }`. `UpstreamError` becomes HTTP 502 with body `{ error: { kind: 'upstream', service, retryable: true } }`; validation errors are 400.
- Tests with `@nuxt/test-utils` e2e mode (`setup({ server: true })`, fixture provider) covering: each route's response shape, cache headers, the no-price-data area, a 400 on bad input, and the upstream-failure mapping (use a runtime-config switch such as `dataProvider: 'failing'` backed by a tiny provider that throws `UpstreamError`, defined in `server/utils/provider.ts` for tests only).

## Acceptance

- `pnpm quality` and `pnpm --filter @house-cost/web test` green with the route tests.
