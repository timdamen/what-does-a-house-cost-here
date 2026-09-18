# 04 Open-data package: OSM, Nominatim, Overpass and the price registry

Status: done
Type: task
Blocked by: 03

## Goal

Spec section "Data Provider port" bullets 3 to 6 and "Further Notes" on usage policies. Build `@house-cost/open-data` implementing `DataProvider` and `Geocoder` from `@house-cost/domain`.

## Scope

- HTTP client wrapper: takes `userAgent` and a concurrency limit (`p-limit`), sets `User-Agent`, throws `UpstreamError` on non-2xx or network failure. All adapters use it. No adapter reads `process.env`.
- Overpass adapter for Houses: query residential building types (`building` in house, detached, semidetached_house, terrace, apartments, residential, bungalow, …) as ways and nodes with `out center`, within the Search Area (use `around:`), `[timeout:25]`, cap at 300 (named constant, reported as `cap`/`truncated`). Map OSM tags to `House`.
- Overpass adapter for amenities: fixed amenity classes (school, supermarket, healthcare = doctors|hospital|pharmacy|clinic, park = leisure=park, transport = public_transport=stop_position|platform, railway=station, highway=bus_stop), nearest 5 per class with walking minutes via the domain helper.
- Nominatim adapter: reverse geocoding for name and hierarchy (`zoom=16`, `addressdetails=1`), forward search for the Geocoder (`limit=5`).
- Price registry: `PriceAdapter` interface `{ countryCodes: string[]; getPriceSignals(houses); getPriceSummary(location, radius) }`, a registry keyed by country code returning "no data" (`priceSummary: null`, empty signals) for unknown regions as a normal value, and one real adapter for `GB` using HM Land Registry Price Paid Data linked-data API (`https://landregistry.data.gov.uk/data/ppi/transaction-record.json` with `propertyAddress.postcode` filters, or the SPARQL endpoint; pick the one that works over plain HTTP GET with JSON and document it). Match by postcode where a House has one; the summary uses the last 24 months for the area's postcodes.
- `createOpenDataProvider({ userAgent, concurrency, fetch? })` composing the above, and `createNominatimGeocoder`.
- Tests against recorded upstream responses in `test/fixtures/*.json` (record real responses once with a script under `scripts/record-fixtures.ts`, commit the JSON, never hit the network in tests). Run the domain contract test against the open-data provider with the mocked fetch. Cover: house cap, registry no-data path, provenance fields, upstream failure to `UpstreamError`.

## Acceptance

- `pnpm quality` green; no test performs network I/O (assert via a fetch stub that throws on unexpected URLs).
- `packages/open-data/README.md` lists each upstream service, its usage policy URL and how the adapter respects it.

## Comments

- Done. `pnpm quality` green; 58 open-data tests including the domain contract suite against the open-data provider with the fixture stub (Islington = priced `GB` area, Amsterdam = unpriced `NL` area). No test touches the network: `test/helpers/fixture-fetch.ts` serves `test/fixtures/*.json` and throws on unknown URLs and on requests without a `User-Agent`.
- Public API (`@house-cost/open-data`): `createOpenDataProvider({ userAgent, concurrency = 2, fetch = globalThis.fetch, now = () => new Date(), overpassUrl?, nominatimUrl?, landRegistryUrl?, factsRadiusMetres = 500, priceAdapters? })` -> `DataProvider`; `createNominatimGeocoder(sameOptions)` -> `Geocoder`; `createHttpClient({ userAgent, concurrency, fetch })` (`FetchLike`, `HttpClient`); `createPriceRegistry(adapters)` with `PriceAdapter` `{ countryCodes, source, getPriceSignals(houses), getPriceSummary(area, houses) }` and `PriceRegistry`; `createLandRegistryAdapter({ client, url?, now? })`; constants `OVERPASS_SOURCE` (`openstreetmap-overpass`), `NOMINATIM_SOURCE` (`nominatim`), `LAND_REGISTRY_SOURCE` (`hm-land-registry-ppd`), `OVERPASS_URL`, `NOMINATIM_URL`, `LAND_REGISTRY_URL`, `UNKNOWN_COUNTRY_CODE` (`ZZ`), `SUMMARY_WINDOW_MONTHS` (24), `DEFAULT_CONCURRENCY`, `DEFAULT_FACTS_RADIUS_METRES`.
- Provenance `source`: `searchHouses` -> `openstreetmap-overpass`; `getNeighbourhoodFacts` -> `nominatim+openstreetmap-overpass` plus `+hm-land-registry-ppd` when a register served the region; `getPriceSignals` -> the register's source, or `nominatim` when only the country lookup ran (also for an empty House list); geocoder -> `nominatim`. `UpstreamError.service` is `overpass`, `nominatim` or `land-registry`.
- Deviation from the ticket text: `PriceAdapter.getPriceSummary(area, houses)` receives the Houses as well as the area, because Price Paid Data has no coordinates and postcodes come from the Houses' `addr:postcode`. Both operations query the register per distinct postcode (most-populated first, at most 30 per call). Summary: median, p10/p90 nearest rank, last 24 months, category A only; `null` when there are no sales in the window.
- `getPriceSignals` needs a country: one Nominatim reverse lookup on the Houses' centroid picks the adapter. Ticket 11 should cache `/api/prices` by house-id set and expect one Nominatim call per uncached request. Nominatim calls are serialised (single-slot limit inside the shared one) but not paced to 1 req/s; the route cache and explicit-submit geocoding keep the app within policy.
- Fixtures recorded 2026-09-18 03:17 UTC with `pnpm --filter @house-cost/open-data record-fixtures` (`scripts/record-fixtures.ts`, Node 24 native TS, UA `what-does-a-house-cost-here-dev/0.0.0`, one request each, 250 m): Overpass houses and amenities for Islington (51.5385, -0.1025; 115 buildings, 28 with postcodes) and Amsterdam (52.3676, 4.9041; 98 buildings, no addresses), an empty Overpass result at (0, 0), Nominatim reverse for both and search "Amsterdam", Price Paid Data for `N1 0QU` (22 transactions, newest 2023-06-30) and `N1 0YW` (empty). Largest file 73 kB. Tests pin `now` to 2024-01-15 so the 24-month window contains sales; Land Registry requests for unrecorded postcodes get an empty page from the stub. A test asserts the Overpass query builders still match the recorded requests, so changing a query means re-recording.
- Truncation is tested with a generated 301-element Overpass body (no large fixture). The Overpass query asks for `cap + 1` elements (`out center tags 301;`) so `truncated` is exact and downloads stay small.
- Dependencies added (recorded in `../versions.md`): `p-limit` 7.3.2, `@types/node` 26.6.1 (dev). `record-fixtures` is an npm script so knip treats the script as an entry.
