# 0004 One Data Provider port between the app and every open-data source

Status: accepted (2026-09-17)

## Context

The app draws on several community services (Overpass, Nominatim, regional price registers) with strict usage policies, and it must be testable offline (user story 50, "Testing Decisions" seam two). The spec ("Data Provider port") asks for a single port in the domain package with three operations, two implementations, and a contract test both must pass.

Alternatives: let the Nuxt server routes call each service directly (fast to write, but the routes become the only seam and tests need the network or a full HTTP mock), or one port per service (leaks OSM and Nominatim shapes into the UI).

## Decision

- `DataProvider` lives in `@house-cost/domain` with three operations: `searchHouses(area: SearchArea)`, `getNeighbourhoodFacts(location: Location)` and `getPriceSignals(houses: House[])`. Each resolves to `{ data, provenance }` where Provenance is `{ source, fetchedAt }`; `searchHouses` adds `cap` and `truncated`.
- A separate, smaller `Geocoder` port has `search(query)` for the place-search box.
- Failures surface as the typed `UpstreamError` (`{ kind: 'upstream', service, retryable }`). The server maps it to HTTP 502; the One-Pager to a retry message. "No price data" is never an error (ADR-0005).
- Two implementations: the fixture provider in `@house-cost/domain` (deterministic, offline, two fixture areas, one without price data) and the open-data provider in `@house-cost/open-data` (composes the Overpass, Nominatim and price adapters). Nuxt runtime config `dataProvider` selects one; tests always use the fixture.
- A contract test exported from the domain package runs against both providers, so a real adapter cannot drift from what the UI expects.
- The browser never calls an open-data service. The three server routes mirror the three port operations, add caching keyed on rounded Location and Search Radius, and send an identifying User-Agent with a small concurrency limit.

## Consequences

- The domain package has no Nuxt or network dependency and can be unit-tested with plain Vitest; the open-data package depends on domain, never the reverse.
- The UI and the server routes know nothing about OSM tags, Nominatim JSON or register schemas. Adding a source means an adapter behind the port, not a UI change.
- Every result carries Provenance, so the "About this data" facts and the fetched-at display cost nothing extra.
- The port only grows through the spec. Operation-specific fields (`cap`, `truncated`) are allowed; new operations need a spec change.
- Recorded upstream responses under `test/fixtures/` are the only network the tests ever see; a fetch stub that throws on unexpected URLs enforces it.

## References

- Spec `.scratch/house-cost-here-mvp/spec.md`, sections "Data Provider port", "Server routes and caching", "Testing Decisions", "Further Notes".
- `.scratch/house-cost-here-mvp/issues/00-README.md`, "Data Provider port"; tickets 03, 04, 05 and 11.
