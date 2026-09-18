import { AMSTERDAM_CENTRE } from '@house-cost/domain';
import { fetch, setup } from '@nuxt/test-utils/e2e';
import { describe, expect, it } from 'vitest';

/**
 * Boots a second build with `runtimeConfig.dataProvider = 'failing'`, a provider whose every
 * operation rejects with an `UpstreamError`, to pin down the 502 mapping on all routes.
 */
describe('api routes when the upstream provider fails', async () => {
  await setup({
    server: true,
    browser: false,
    nuxtConfig: { runtimeConfig: { dataProvider: 'failing' } },
  });

  const requests: Array<[string, () => Promise<Response>]> = [
    [
      'GET /api/houses',
      () => fetch(`/api/houses?lat=${AMSTERDAM_CENTRE.lat}&lng=${AMSTERDAM_CENTRE.lng}`),
    ],
    [
      'GET /api/facts',
      () => fetch(`/api/facts?lat=${AMSTERDAM_CENTRE.lat}&lng=${AMSTERDAM_CENTRE.lng}`),
    ],
    [
      'POST /api/prices',
      () =>
        fetch('/api/prices', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ houses: [{ id: 'way/900000001', location: AMSTERDAM_CENTRE }] }),
        }),
    ],
    ['GET /api/geocode', () => fetch('/api/geocode?q=amsterdam')],
  ];

  it.each(requests)(
    '%s maps an UpstreamError to 502 with the upstream envelope',
    async (_, request) => {
      const response = await request();

      expect(response.status).toBe(502);
      expect(response.headers.get('cache-control') ?? '').not.toContain('max-age');
      expect(await response.json()).toEqual({
        error: { kind: 'upstream', service: 'failing-provider', retryable: true },
      });
    },
  );

  it('still validates input before touching the provider', async () => {
    const response = await fetch('/api/houses?lat=abc&lng=4.9');

    expect(response.status).toBe(400);
  });
});
