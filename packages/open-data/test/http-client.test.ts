import { UpstreamError } from '@house-cost/domain';
import { describe, expect, it, vi } from 'vitest';

import { createHttpClient, type FetchLike } from '../src/http-client';
import { jsonResponse } from './helpers/fixture-fetch';

const USER_AGENT = 'house-cost-tests/0.0.0 (+https://example.test)';

function clientWith(fetch: FetchLike, concurrency = 2) {
  return createHttpClient({ userAgent: USER_AGENT, concurrency, fetch });
}

describe('createHttpClient', () => {
  it('sends the identifying User-Agent and an Accept header on every request', async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ ok: true }));
    const client = clientWith(fetch);

    await expect(client.json('https://example.test/a', { service: 'svc' })).resolves.toEqual({
      ok: true,
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://example.test/a');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ 'User-Agent': USER_AGENT, Accept: 'application/json' });
  });

  it('POSTs form bodies as application/x-www-form-urlencoded', async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({}));
    const client = clientWith(fetch);

    await client.json('https://example.test/q', {
      service: 'svc',
      method: 'POST',
      form: { data: '[out:json];' },
    });

    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('data=%5Bout%3Ajson%5D%3B');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
  });

  it('maps non-2xx responses to UpstreamError, retryable for 429 and 5xx only', async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 429))
      .mockResolvedValueOnce(jsonResponse({ error: 'bad' }, 400));
    const client = clientWith(fetch);

    const busy = await client.json('https://example.test', { service: 'overpass' }).catch((e) => e);
    expect(busy).toBeInstanceOf(UpstreamError);
    expect(busy).toMatchObject({ kind: 'upstream', service: 'overpass', retryable: true });

    const bad = await client.json('https://example.test', { service: 'overpass' }).catch((e) => e);
    expect(bad).toMatchObject({ kind: 'upstream', service: 'overpass', retryable: false });
  });

  it('maps network failures and non-JSON bodies to retryable UpstreamError', async () => {
    const network = clientWith(vi.fn<FetchLike>().mockRejectedValue(new TypeError('offline')));
    const offline = await network.json('https://example.test', { service: 'svc' }).catch((e) => e);
    expect(offline).toBeInstanceOf(UpstreamError);
    expect(offline).toMatchObject({ service: 'svc', retryable: true });
    expect((offline as Error).cause).toBeInstanceOf(TypeError);

    const html = clientWith(
      vi.fn<FetchLike>().mockResolvedValue(new Response('<html>oops</html>', { status: 200 })),
    );
    const notJson = await html.json('https://example.test', { service: 'svc' }).catch((e) => e);
    expect(notJson).toMatchObject({ kind: 'upstream', service: 'svc', retryable: true });
  });

  it('never has more than `concurrency` requests in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetch: FetchLike = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return jsonResponse({});
    };
    const client = clientWith(fetch, 2);

    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        client.json(`https://example.test/${i}`, { service: 'svc' }),
      ),
    );

    expect(peak).toBe(2);
  });
});
