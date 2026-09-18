import type { House, PriceSignal, PriceSummary, SearchArea } from '@house-cost/domain';

/**
 * A regional open price register. One adapter per register; the registry picks one by the
 * country code Nominatim reports for the Location.
 *
 * Registers rarely carry coordinates, so both operations receive the Houses (with their
 * addresses) as the geographic key rather than a bare Location.
 */
export interface PriceAdapter {
  /** ISO 3166-1 alpha-2 codes, upper case, this adapter serves. */
  readonly countryCodes: readonly string[];
  /** `provenance.source` and `PriceSignal.source` for data from this register. */
  readonly source: string;
  getPriceSignals(houses: readonly House[]): Promise<PriceSignal[]>;
  /** `null` when the register has nothing for the area (also a normal value). */
  getPriceSummary(area: SearchArea, houses: readonly House[]): Promise<PriceSummary | null>;
}

export interface PriceRegistry {
  /** The adapter for a country, or `undefined`: "no open price data for this region". */
  adapterFor(countryCode: string): PriceAdapter | undefined;
  /** Every country code with an adapter, upper case. */
  readonly countryCodes: readonly string[];
}

/** Builds a registry keyed by country code. Later adapters win on duplicate codes. */
export function createPriceRegistry(adapters: readonly PriceAdapter[]): PriceRegistry {
  const byCountry = new Map<string, PriceAdapter>();
  for (const adapter of adapters) {
    for (const code of adapter.countryCodes) byCountry.set(code.toUpperCase(), adapter);
  }
  return {
    adapterFor: (countryCode) => byCountry.get(countryCode.toUpperCase()),
    countryCodes: [...byCountry.keys()],
  };
}
