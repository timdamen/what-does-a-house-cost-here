import { describe, expect, it } from 'vitest';

import { createPriceRegistry, type PriceAdapter } from '../src/prices/registry';

function adapter(countryCodes: string[], source: string): PriceAdapter {
  return {
    countryCodes,
    source,
    getPriceSignals: async () => [],
    getPriceSummary: async () => null,
  };
}

describe('createPriceRegistry', () => {
  it('finds adapters by country code regardless of case and reports the covered codes', () => {
    const registry = createPriceRegistry([
      adapter(['GB'], 'ppd'),
      adapter(['nl', 'BE'], 'kadaster'),
    ]);
    expect(registry.adapterFor('gb')?.source).toBe('ppd');
    expect(registry.adapterFor('NL')?.source).toBe('kadaster');
    expect(registry.countryCodes).toEqual(['GB', 'NL', 'BE']);
  });

  it('returns undefined ("no data") for regions without an adapter, never throws', () => {
    const registry = createPriceRegistry([adapter(['GB'], 'ppd')]);
    expect(registry.adapterFor('AU')).toBeUndefined();
    expect(registry.adapterFor('ZZ')).toBeUndefined();
    expect(createPriceRegistry([]).adapterFor('GB')).toBeUndefined();
  });
});
