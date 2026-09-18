# 04 Open-data package: OSM, Nominatim, Overpass and the price registry

Status: ready-for-agent
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
