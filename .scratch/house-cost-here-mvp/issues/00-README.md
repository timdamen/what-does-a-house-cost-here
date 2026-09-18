# Tickets for the House Cost Here MVP

Spec: `../spec.md`. One ticket per file, numbered from 01. `Blocked by:` lists the tickets that must be `Status: done` first.

## Shared decisions (read before any ticket)

These are fixed so tickets running in parallel agree. Change them only through the spec.

- **Layout**: pnpm workspaces. `apps/web` (Nuxt app, package name `@house-cost/web`), `packages/domain` (`@house-cost/domain`), `packages/open-data` (`@house-cost/open-data`).
- **Versions**: pinned exactly, verified against the registry on 2026-09-17. See `../versions.md`.
- **Node**: 24 (`.nvmrc` = `24`). Package manager: `pnpm@10.32.1` via `packageManager` field.
- **Data Provider port** (`@house-cost/domain`): interface `DataProvider` with `searchHouses(area: SearchArea)`, `getNeighbourhoodFacts(location: Location)`, `getPriceSignals(houses: House[])`. Each resolves to `{ data, provenance: { source: string; fetchedAt: string } }` plus any operation-specific fields the ticket defines. A separate small `Geocoder` port has `search(query: string)` (forward geocoding for the place-search box). Fixture implementations of both live in the domain package.
- **Runtime config** (Nuxt): `dataProvider: 'fixture' | 'open-data'` (env `NUXT_DATA_PROVIDER`, default `fixture` in dev/test, `open-data` in production), `public.mapStyleLight`, `public.mapStyleDark` (env `NUXT_PUBLIC_MAP_STYLE_LIGHT/DARK`), `userAgent` (env `NUXT_USER_AGENT`).
- **Server routes**: `GET /api/houses?lat&lng&radius`, `GET /api/facts?lat&lng`, `POST /api/prices` (body: house ids + locations), `GET /api/geocode?q`. Coordinates are rounded to 4 decimals on the server before use or caching.
- **URL state**: `/?lat=52.3676&lng=4.9041&r=500&h=<selected house id>` is the source of truth for Location, Search Radius (metres) and selection.
- **Radius options and default**: taken from the research note (`docs/research/mobile-map-ux.md`) once ticket 01 is done. Before that, use `[250, 500, 1000, 2000]` with default `500`.
- **Map tiles**: VersaTiles open host, light `https://tiles.versatiles.org/assets/styles/colorful/style.json`, dark `https://tiles.versatiles.org/assets/styles/eclipse/style.json`, unless research overturns it.
- **Real price adapter region**: England and Wales via HM Land Registry Price Paid Data linked-data API (`https://landregistry.data.gov.uk/`). Registry key: ISO country code `GB`.
- **Commits**: Conventional Commits (`feat(web): …`, `chore(tooling): …`, `docs: …`, `test(domain): …`).
- **Tests**: Vitest everywhere. Package unit tests with recorded fixtures under `test/fixtures/`. App tests via `@nuxt/test-utils` (e2e mode with Playwright for browser tests).
- **Quality**: `pnpm quality` at the root runs fmt check, lint, typecheck, knip, unit tests. Every ticket must leave `pnpm quality` green.
