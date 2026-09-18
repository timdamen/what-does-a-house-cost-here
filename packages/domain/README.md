# @house-cost/domain

Types, the Data Provider port, geo helpers, price formatting and the deterministic fixture
provider. Browser-safe TypeScript source, no build step.

## The port

```ts
interface DataProvider {
  searchHouses(area: SearchArea): Promise<{ data: House[]; cap; truncated; provenance }>;
  getNeighbourhoodFacts(area: SearchArea): Promise<{ data: NeighbourhoodFacts; provenance }>;
  getPriceSignals(houses: HouseRef[]): Promise<{ data: PriceSignal[]; provenance }>;
}

interface Geocoder {
  search(query: string): Promise<{ data: GeocodeResult[]; provenance }>;
}
```

- `provenance` is `{ source, fetchedAt }` on every result.
- `searchHouses` returns at most `cap` Houses (`HOUSE_CAP`, 300) and sets `truncated` when more
  matched.
- "No open price data for this region" is a normal value: `priceSummary: null` and an empty
  `getPriceSignals` list. Upstream failures reject with `UpstreamError`
  (`{ kind: 'upstream', service, retryable }`).
- `PriceSignal.houseId` links each signal to the House it was resolved for, whatever its `scope`.
- `getNeighbourhoodFacts` takes the whole Search Area: amenities and the Housing Mix follow its
  Search Radius, so the facts describe what the map shows.
- `getPriceSignals` takes `HouseRef` (`{ id, location, address? }`), the part of a House a
  register lookup keys on, so the server route never has to invent building types or tags.
- `PriceSummary.windowMonths` says how many months of sales before `asOf` the summary covers.
- `DEFAULT_RADIUS_METRES` (500) is the Search Radius when none is given; `countHousingMix` counts
  Houses per building type.

## Fixtures

`createFixtureProvider()` serves two areas: Amsterdam (`AMSTERDAM_CENTRE`, about 120 Houses,
roughly half with EUR Price Signals, full Neighbourhood Facts) and Sydney (`SYDNEY_CENTRE`,
country `AU`, no price data). The Housing Mix counts the Houses inside the Search Area; the
amenities are the whole fixture town's, nearest first, whatever the Search Radius. `createFixtureGeocoder()` resolves place names such as
"Amsterdam" and "Sydney", and postcode-looking strings. Both accept `{ now }` for a fixed clock.

## Contract test

```ts
import { runDataProviderContract } from '@house-cost/domain/testing';

runDataProviderContract('open-data', () => ({ provider, pricedArea, unpricedArea }));
```

Every provider must pass it. It asserts result shapes, the cap, provenance and the no-data path.
