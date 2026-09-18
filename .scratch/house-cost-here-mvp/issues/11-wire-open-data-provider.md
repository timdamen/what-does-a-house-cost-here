# 11 Wire the open-data provider into the app

Status: done
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

## Comments

- Done. `pnpm quality` green; tests unchanged and still on the fixture provider. `server/utils/provider.ts` builds `createOpenDataProvider` and `createNominatimGeocoder` from one shared `OpenDataOptions` (`userAgent` from `runtimeConfig.userAgent`, `concurrency: 2`, exported as `OPEN_DATA_CONCURRENCY`) inside the existing singleton-per-name map; an empty `userAgent` throws at first use rather than sending anonymous requests. The default User-Agent is `what-does-a-house-cost-here/<apps/web version> (+https://github.com/timdamen/what-does-a-house-cost-here)`, built in `nuxt.config.ts` from `package.json`'s `version`. `dataProvider` already defaulted to `open-data` when `NODE_ENV=production` and `fixture` otherwise; the comment now says so. `.env.example` at the repo root documents `NUXT_DATA_PROVIDER`, `NUXT_USER_AGENT`, `NUXT_PUBLIC_MAP_STYLE_LIGHT` and `NUXT_PUBLIC_MAP_STYLE_DARK` (`.gitignore` already whitelists it).
- Manual smoke check on 2026-09-18 03:30 UTC with `NUXT_DATA_PROVIDER=open-data pnpm --filter @house-cost/web dev --port 3111`, one `curl` per route per Location, cold cache:
  - `GET http://localhost:3111/api/houses?lat=51.5385&lng=-0.1025&radius=250` -> 200 in 2.0 s, 115 Houses (28 with postcodes), `cap` 300, `truncated` false, source `openstreetmap-overpass`.
  - `GET http://localhost:3111/api/facts?lat=51.5385&lng=-0.1025` -> 200 in 5.4 s, name `Canonbury` (suburb Islington, country code `GB`), 5 amenities per class, `priceSummary` `{ typical: 2265414, low: 650000, high: 4200000, currency: GBP, asOf: 2026-03-20, sampleSize: 15 }`, source `nominatim+openstreetmap-overpass+hm-land-registry-ppd`.
  - `POST http://localhost:3111/api/prices` with six of those Houses (`way/1218238520` N1 2RR, `way/31024612`, `way/31024611`, `way/31024610` at 2-4 Moon Street N1 0QU, plus `way/31307483` and `way/27821166` without postcodes) -> 200 in 1.5 s, 6 signals (`house` sales for 2 and 3 Moon Street, `street` sales for the others with a postcode, none for the two without), source `hm-land-registry-ppd`.
  - `GET http://localhost:3111/api/houses?lat=52.3676&lng=4.9041&radius=250` -> 200 in 4.2 s, 98 Houses, `truncated` false, source `openstreetmap-overpass`.
  - `GET http://localhost:3111/api/facts?lat=52.3676&lng=4.9041` -> 200 in 4.4 s, name `Nieuwmarkt/Lastage` (city Amsterdam, country code `NL`), `priceSummary: null`, source `nominatim+openstreetmap-overpass` (the no-data path, as a 200).
  - `GET http://localhost:3111/api/geocode?q=Amsterdam` -> 200 in 0.03 s (kept-alive Nominatim connection from the facts lookup), 5 results, first `Amsterdam, Noord-Holland, Nederland` at 52.3731, 4.8925, country code `NL`, source `nominatim`.
  - All 200s carried the expected `Cache-Control` (6 h for houses and facts, 24 h for prices and geocode). In dev the cache is on disk under `apps/web/.nuxt/cache/nitro/functions/<name>/open-data/...`, not `.nitro/cache` as ticket 05's comment says.
- For ticket 15 (Vercel): cold responses take 2-5.5 s, dominated by Overpass (facts runs Nominatim reverse, then Overpass amenities, then Land Registry per postcode); set the serverless function timeout well above 10 s and keep `maxDuration` at 30 s or more. The Nitro cache is in-memory in production, so every cold function instance re-fetches; a shared KV cache driver is worth considering if Overpass 429s appear. Nothing was rate-limited during this check.

