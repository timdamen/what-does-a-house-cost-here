import type { Location, SearchArea } from '@house-cost/domain';

import { createOpenDataProvider, type OpenDataOptions } from '../../src/provider';
import { createFixtureFetch, type FixtureFetch } from './fixture-fetch';

/** Centres the fixtures were recorded around (see `scripts/record-fixtures.ts`). */
export const ISLINGTON: Location = { lat: 51.5385, lng: -0.1025 };
export const AMSTERDAM: Location = { lat: 52.3676, lng: 4.9041 };

/** Radius the fixtures were recorded with. */
export const RECORDED_RADIUS_METRES = 250;

export const ISLINGTON_AREA: SearchArea = {
  centre: ISLINGTON,
  radiusMetres: RECORDED_RADIUS_METRES,
};
export const AMSTERDAM_AREA: SearchArea = {
  centre: AMSTERDAM,
  radiusMetres: RECORDED_RADIUS_METRES,
};

/**
 * Fixed clock. The fixtures were recorded on 2026-09-17, but the newest Price Paid sale in the
 * recorded postcode (N1 0QU) is 2023-06-30, so the 24-month summary window is anchored here to
 * contain sales.
 */
export const FIXED_NOW = new Date('2024-01-15T12:00:00Z');

export const TEST_USER_AGENT = 'house-cost-tests/0.0.0 (+https://example.test)';

export interface TestSubject {
  provider: ReturnType<typeof createOpenDataProvider>;
  fetch: FixtureFetch;
}

/** The open-data provider wired to the fixture stub, with radii matching the recordings. */
export function createTestSubject(overrides: Partial<OpenDataOptions> = {}): TestSubject {
  const fetch = createFixtureFetch();
  const provider = createOpenDataProvider({
    userAgent: TEST_USER_AGENT,
    fetch,
    now: () => FIXED_NOW,
    factsRadiusMetres: RECORDED_RADIUS_METRES,
    ...overrides,
  });
  return { provider, fetch };
}
