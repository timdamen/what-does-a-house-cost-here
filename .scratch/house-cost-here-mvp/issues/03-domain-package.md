# 03 Domain package: types, ports, geo helpers, fixture providers

Status: ready-for-agent
Type: task
Blocked by: 02

## Goal

Spec sections "Data Provider port" and glossary; user story 50. Build `@house-cost/domain`.

## Scope

- Types: `Location` (`lat`, `lng`), `SearchArea` (`centre`, `radiusMetres`), `House` (`id`, `location`, `address` fields as OSM has them: `street`, `housenumber`, `postcode`, `city`; `buildingType` from a fixed union such as `detached | semi-detached | terraced | apartments | house | residential | other`; `osmTags` subset), `PriceSignal` (`amount`, `currency` ISO code, `kind: 'sale' | 'valuation'`, `date`, `scope: 'house' | 'street' | 'area'`, `source`), `NeighbourhoodFacts` (`name`, `hierarchy` {suburb, city, region, country, countryCode}, `priceSummary` with `typical`, `low`, `high`, `currency`, `asOf`, `sampleSize` or `null` meaning "no open price data for this region", `amenities` grouped by class `school | supermarket | healthcare | park | transport` each with `name`, `location`, `distanceMetres`, `walkingMinutes`, `housingMix` counts by building type), `Provenance` (`source`, `fetchedAt`), `GeocodeResult` (`label`, `location`, `countryCode`), typed error `UpstreamError` (`{ kind: 'upstream'; service: string; retryable: boolean }`).
- Port `DataProvider` (three operations from `00-README.md`) and `Geocoder` (`search`). `searchHouses` returns `{ data: House[], cap: number, truncated: boolean, provenance }`.
- Geo helpers: haversine distance, walking minutes from straight-line distance (use 80 m/min and a 1.3 detour factor; state both as named constants), bounding box for a circle, rounding a Location to 4 decimals, `formatPrice(amount, currency, locale)` and abbreviated form (`€312k`) using `Intl.NumberFormat`, locale-from-country-code helper.
- Fixture provider: deterministic, offline. A fixture town of about 120 Houses around a fixed centre (pick Amsterdam-ish coordinates), roughly half with Price Signals, a fixture Neighbourhood Facts with all amenity classes and a price summary, and a second fixture area (any centre far away) that returns `priceSummary: null` and no Price Signals so the "no open price data" path is testable. Fixture geocoder returns a few named places including both centres.
- Contract test: `test/contract/data-provider.contract.ts` exporting a function `runDataProviderContract(name, factory)` that asserts shapes, the cap, provenance fields and the no-data path. Run it against the fixture provider here; ticket 04 runs it against the open-data provider.
- Unit tests for geo helpers and formatting.

## Acceptance

- `pnpm quality` green. Contract test passes against the fixture provider.
- `packages/domain/README.md` documents the port in a few lines.
