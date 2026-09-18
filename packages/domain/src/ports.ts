import type {
  GeocodeResult,
  House,
  HouseRef,
  NeighbourhoodFacts,
  PriceSignal,
  Provenance,
  SearchArea,
} from './types';

/** Every port operation resolves to its data plus provenance. */
export interface ProviderResult<T> {
  data: T;
  provenance: Provenance;
}

/** Maximum number of Houses a single `searchHouses` call returns. Reported to the UI as `cap`. */
export const HOUSE_CAP = 300;

export interface HouseSearchResult extends ProviderResult<House[]> {
  /** The cap that applied to this request (normally `HOUSE_CAP`). */
  cap: number;
  /** `true` when more Houses matched than `cap` allowed; `data.length === cap` in that case. */
  truncated: boolean;
}

export type NeighbourhoodFactsResult = ProviderResult<NeighbourhoodFacts>;
export type PriceSignalsResult = ProviderResult<PriceSignal[]>;
export type GeocodeSearchResult = ProviderResult<GeocodeResult[]>;

/**
 * The Data Provider port. The fixture provider (this package) and the open-data provider
 * (`@house-cost/open-data`) both implement it; `runDataProviderContract` from
 * `@house-cost/domain/testing` pins down what any implementation must satisfy.
 *
 * Operations reject with `UpstreamError` when an upstream service fails. "No price data for this
 * region" is not a failure: it is `priceSummary: null` and an empty `getPriceSignals` result.
 */
export interface DataProvider {
  searchHouses(area: SearchArea): Promise<HouseSearchResult>;
  /** Facts for the Search Area: amenities and the Housing Mix follow its Search Radius. */
  getNeighbourhoodFacts(area: SearchArea): Promise<NeighbourhoodFactsResult>;
  getPriceSignals(houses: readonly HouseRef[]): Promise<PriceSignalsResult>;
}

/** Forward geocoding for the place-search box. */
export interface Geocoder {
  search(query: string): Promise<GeocodeSearchResult>;
}
