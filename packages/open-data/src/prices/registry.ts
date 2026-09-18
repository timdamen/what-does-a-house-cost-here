import type { HouseRef, PriceSignal, PriceSummary } from '@house-cost/domain';

/**
 * A regional open price register. One adapter per register; the registry picks one by the
 * country code Nominatim reports for the Location.
 *
 * Registers rarely index by Location, so both operations receive the Houses (id, Location and
 * address) as the geographic key rather than a bare Location or Search Area.
 */
export interface PriceAdapter {
  /** ISO 3166-1 alpha-2 codes, upper case, this adapter serves. */
  readonly countryCodes: readonly string[];
  /** `provenance.source` and `PriceSignal.source` for data from this register. */
  readonly source: string;
  getPriceSignals(houses: readonly HouseRef[]): Promise<PriceSignal[]>;
  /** The summary for the Houses' area; `null` when the register has nothing for it (a normal value). */
  getPriceSummary(houses: readonly HouseRef[]): Promise<PriceSummary | null>;
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
