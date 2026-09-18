# @house-cost/open-data

The real `DataProvider` and `Geocoder` from `@house-cost/domain`, built on OpenStreetMap
(Overpass), Nominatim and a registry of regional price registers (HM Land Registry Price Paid
Data for `GB`). TypeScript source, no build step. Server-side only: the browser never calls these
services.

## Usage

```ts
import {
  createNominatimGeocoder,
  createOpenDataProvider,
  createOpenDataRuntime,
} from '@house-cost/open-data';

// One runtime per process: it holds the HTTP client (concurrency limit) and the Nominatim
// client (one request at a time, a second apart) that the provider and the geocoder share.
const runtime = createOpenDataRuntime({
  userAgent: 'what-does-a-house-cost-here/0.1 (+https://example.org/contact)',
  concurrency: 2, // default
  // fetch, now, overpassUrl, nominatimUrl, landRegistryUrl, priceAdapters
});
const provider = createOpenDataProvider(runtime);
const geocoder = createNominatimGeocoder(runtime);
```

- `searchHouses(area)`: residential buildings from Overpass, nearest first, at most `HOUSE_CAP`
  (300). The query asks for `cap + 1` elements, so `truncated` is exact and the download bounded.
  `provenance.source` is `openstreetmap-overpass`.
- `getNeighbourhoodFacts(area)`: name and hierarchy from Nominatim reverse geocoding (`zoom=16`),
  amenities (nearest 5 per class) and housing mix from Overpass within the area's Search Radius,
  and a price summary from the register for the country Nominatim reports. `provenance.source`
  joins the contributors with `+`, e.g. `nominatim+openstreetmap-overpass+hm-land-registry-ppd`.
  The Houses of an area are memoised for `HOUSES_MEMO_TTL_MS` (10 minutes, in flight included),
  so the app asking for Houses and facts at the same moment costs one Overpass houses query, not
  two; the register also needs them for its postcodes.
- `getPriceSignals(houses)`: takes `HouseRef` (`{ id, location, address? }`). One Nominatim
  reverse lookup on the Houses' centroid picks the register; no register means `data: []`
  (`provenance.source` `nominatim`).
- `search(query)` (Geocoder): Nominatim `/search`, `limit=5`. Call it on an explicit submit only.
- Every operation rejects with `UpstreamError` (`service`: `overpass`, `nominatim` or
  `land-registry`; `retryable` for 429/5xx/network) when a service fails. "No open price data
  for this region" is a value (`priceSummary: null`, empty signals), never an error.
- Locations are rounded to 4 decimals before any request. Nothing reads `process.env`.

## Price registry

`PriceAdapter` is `{ countryCodes, source, getPriceSignals(houses), getPriceSummary(houses) }`.
Registers rarely index by Location, so adapters receive the Houses (`HouseRef`: id, Location and
`addr:*` fields) as the geographic key. `createPriceRegistry(adapters)` keys them by ISO country code; unknown codes
return `undefined`, which the provider reports as "no data". Add a region by writing an adapter
and passing `priceAdapters` (or extending the default list in `provider.ts`).

### GB: HM Land Registry Price Paid Data

Linked Data API, `GET https://landregistry.data.gov.uk/data/ppi/transaction-record.json` with
`propertyAddress.postcode=<postcode>&_pageSize=100&_sort=-transactionDate`. Plain HTTP GET with
JSON output; the SPARQL endpoint is not used. One request per distinct postcode among the Houses,
most-populated postcodes first, at most `MAX_POSTCODES_PER_CALL` (30) per operation.

- Signals: transactions whose PAON equals the House's `housenumber` are `scope: 'house'` (newest
  5); otherwise the newest sale in the postcode is one `scope: 'street'` signal. `kind` is
  always `sale`, currency `GBP`.
- Summary: category A (standard) sales in the last `SUMMARY_WINDOW_MONTHS` (24, reported as
  `windowMonths`). `typical` is the median, `low`/`high` the 10th and 90th percentiles by nearest
  rank (min/max for small samples), `asOf` the newest sale date, `sampleSize` the count. No sales
  in the window gives `null`.

## Upstream services and their policies

| Service                                                       | Policy                                                                                                                                                                                     | How this package complies                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overpass API (`overpass-api.de`)                              | https://dev.overpass-api.de/overpass-doc/en/preface/commons.html (about 10 000 requests and 1 GB per day per user; 429/504 when overloaded)                                                | `[timeout:25]`, `out center tags` (no node lists), result limit `cap + 1`, one amenities query per Location, identifying `User-Agent`, concurrency 2, endpoint configurable for a mirror or self-hosted instance. The app caches per rounded Location and radius.                                  |
| Nominatim (`nominatim.openstreetmap.org`)                     | https://operations.osmfoundation.org/policies/nominatim/ (max 1 request/second, identifying `User-Agent` or Referer, no autocomplete, results must be cached)                              | `User-Agent` required by the options, one Nominatim client per runtime that lets one request through at a time and starts them at least `NOMINATIM_MIN_INTERVAL_MS` (1 s) apart, `/search` only on explicit submit with `limit=5`, reverse lookups on rounded Locations so the app can cache them. |
| HM Land Registry Price Paid Data (`landregistry.data.gov.uk`) | Open Government Licence v3.0, https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads and https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ | Bounded requests per operation, `_pageSize=100`, identifying `User-Agent`. Address data is used only to display residential property price information, the permitted use.                                                                                                                         |

Attribution the app must display:

- "© OpenStreetMap contributors" (ODbL, https://www.openstreetmap.org/copyright) for Houses,
  amenities and geocoding.
- "Contains HM Land Registry data © Crown copyright and database right 2026. This data is
  licensed under the Open Government Licence v3.0." for prices.

## HTTP client

`createHttpClient({ userAgent, concurrency, fetch })` is the only path to the network: it sets
`User-Agent` and `Accept`, limits concurrency with `p-limit`, and turns non-2xx responses, network
failures and non-JSON bodies into `UpstreamError`. Adapters never call `fetch` directly. The
runtime builds one client and the provider and geocoder share it, so the limit is per process.

## Tests and fixtures

Tests never touch the network. `test/helpers/fixture-fetch.ts` serves the recorded responses in
`test/fixtures/` and throws on any request it does not recognise (and on any request without a
`User-Agent`). Land Registry requests for postcodes without a recording get an empty result page.

Fixtures were recorded on 2026-09-17 with `pnpm --filter @house-cost/open-data record-fixtures`
(`scripts/record-fixtures.ts`, Node 24, one request per endpoint, 250 m radius): Overpass houses
and amenities around Islington (51.5385, -0.1025) and Amsterdam (52.3676, 4.9041), an empty
Overpass result at (0, 0), Nominatim reverse for both centres and a search for "Amsterdam", and
Price Paid Data for `N1 0QU` and `N1 0YW` (the latter is empty). Tests pin `now` to 2024-01-15
because the newest recorded sale is from June 2023. Re-record when an Overpass query changes: a
test compares the query builders with the recorded requests.
