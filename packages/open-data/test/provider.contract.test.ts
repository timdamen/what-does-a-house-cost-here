import { runDataProviderContract } from '@house-cost/domain/testing';

import { AMSTERDAM_AREA, createTestSubject, ISLINGTON_AREA } from './helpers/subject';

/**
 * The domain contract against the open-data provider with the fixture stub: Islington (GB, Price
 * Paid Data) is the priced area, Amsterdam (NL, no adapter) the unpriced one. No network.
 */
runDataProviderContract('open-data', () => ({
  provider: createTestSubject().provider,
  pricedArea: ISLINGTON_AREA,
  unpricedArea: AMSTERDAM_AREA,
}));
