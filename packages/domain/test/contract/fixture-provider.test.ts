import { runDataProviderContract } from '../../src/testing';
import { AMSTERDAM_CENTRE, createFixtureProvider, SYDNEY_CENTRE } from '../../src/index';

runDataProviderContract('fixture', () => ({
  provider: createFixtureProvider(),
  pricedArea: { centre: AMSTERDAM_CENTRE, radiusMetres: 500 },
  unpricedArea: { centre: SYDNEY_CENTRE, radiusMetres: 500 },
}));
