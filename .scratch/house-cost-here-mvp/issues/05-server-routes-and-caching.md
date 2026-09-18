# 05 Server routes and caching

Status: done
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

## Comments

- Done. `pnpm quality` green; `pnpm test:e2e` (root, now `pnpm --filter @house-cost/web test:e2e`) runs 19 route tests in two builds: `test/e2e/api.test.ts` (fixture provider) and `test/e2e/api-upstream-failure.test.ts` (`nuxtConfig.runtimeConfig.dataProvider = 'failing'`). Added `zod` 4.6.5 to `apps/web` (recorded in `../versions.md`).
- Route contracts (all under `/api`, JSON, coordinates rounded to 4 decimals server-side, `radius` in metres):
  - `GET /api/houses?lat&lng&radius` (radius optional, default 500, integer 50..5000) -> `{ data: House[], cap, truncated, provenance }`; `Cache-Control: public, max-age=21600, s-maxage=21600`.
  - `GET /api/facts?lat&lng` -> `{ data: NeighbourhoodFacts, provenance }`; `priceSummary: null` is a 200 (Sydney fixture); same 6 h header.
  - `POST /api/prices` body `{ houses: Array<{ id, location: { lat, lng }, address? }> }` (max `HOUSE_CAP` entries) -> `{ data: PriceSignal[], provenance }`; signals carry `houseId`; empty `data` when the region has no register; `Cache-Control: public, max-age=86400, s-maxage=86400` (browsers do not cache POST; the header documents the server TTL).
  - `GET /api/geocode?q` -> `{ data: GeocodeResult[], provenance }`; 24 h header; no match is `data: []`.
  - Errors: 400 `{ error: { kind: 'validation', message, issues: [{ path: string[], message }] } }`; 502 `{ error: { kind: 'upstream', service, retryable } }`. Error responses carry no cache header. Clients see these as `FetchError.data` (`$fetch`/`useFetch` reject on non-2xx); `isUpstreamError(error.data?.error)` from the domain package narrows the 502 case.
- Caching uses `defineCachedFunction` inside plain handlers rather than `defineCachedEventHandler`: Nitro 2.13's cached handler overwrites `Cache-Control` with `s-maxage=…, stale-while-revalidate` (no browser `max-age`) and keys on the URL, which does not fit `POST /api/prices`. Keys are `<providerName>:<rounded lat>:<rounded lng>:<radius>` (houses), `<providerName>:<lat>:<lng>` (facts), a digest of the sorted house ids (prices) and of the lower-cased query (geocode), so switching providers never serves stale results from another. Storage is Nitro's default `cache` mount (memory in production, `.nitro/cache` on disk in dev). Failed provider calls are not cached (the resolver throws before the entry is written).
- Provider selection (`server/utils/provider.ts`): `useDataProvider(event)` / `useGeocoder(event)` read `runtimeConfig.dataProvider` (`NUXT_DATA_PROVIDER`): `fixture` (default outside production), `failing` (test-only, every operation rejects with `UpstreamError('failing-provider')`), `open-data` (throws "not wired yet"; ticket 11 replaces that branch with the open-data adapters and keeps the singleton-per-name map). `providerName(event)` is exported for cache keys.
- `h3` is added to knip's `ignoreDependencies` for `apps/web`: the routes import h3 types only (`H3Event`, `EventHandler`), which Nuxt provides through `.nuxt/tsconfig.server.json` paths; the package is deliberately not pinned (see `../versions.md`).
- `server/api/health.get.ts` stays: it is the proof that both workspace packages bundle into the server build (ticket 02/03 comments).
- For ticket 08: the success types of every route flow through Nitro's `InternalApi`, so `useFetch('/api/houses', { query })` infers `HouseSearchResult`. Build `POST /api/prices` bodies from the Houses already fetched (`{ id, location, address }`), and treat `data.length === 0` as "no price data", not an error.

