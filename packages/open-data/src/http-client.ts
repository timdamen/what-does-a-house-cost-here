import { UpstreamError } from '@house-cost/domain';
import pLimit from 'p-limit';

/**
 * The shape of `fetch` the adapters need. `globalThis.fetch` satisfies it; tests inject a stub
 * that serves recorded fixtures and throws on any URL it does not know.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface HttpClientOptions {
  /** Sent as `User-Agent` on every request. Nominatim requires an identifying one. */
  userAgent: string;
  /** Maximum number of upstream requests in flight at once, across all services. */
  concurrency: number;
  fetch?: FetchLike;
}

export interface JsonRequest {
  /** Name of the upstream service, reported in `UpstreamError.service`. */
  service: string;
  method?: 'GET' | 'POST';
  /** Extra headers on top of `User-Agent` and `Accept`. */
  headers?: Record<string, string>;
  /** Form body for POST requests, sent as `application/x-www-form-urlencoded`. */
  form?: Record<string, string>;
  /**
   * Retry once after a retryable failure (network error, 429, 5xx), waiting `delayMs` first.
   * Off by default: Nominatim must never be retried on 429; Overpass opts in because its
   * gateway answers 504 under load a few seconds before the query itself would have finished.
   */
  retry?: { delayMs: number };
}

export interface HttpClient {
  /** Fetches a JSON document, mapping any failure to `UpstreamError`. */
  json(url: string, request: JsonRequest): Promise<unknown>;
}

/** HTTP statuses after which a retry is worth offering to the user. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * The one HTTP client every adapter uses. Sets the identifying `User-Agent`, limits concurrency
 * with `p-limit`, and turns non-2xx responses, network failures and malformed bodies into
 * `UpstreamError`. Nothing here reads `process.env`.
 */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const limit = pLimit(Math.max(1, Math.floor(options.concurrency)));

  return {
    json(url, request) {
      return limit(async () => {
        try {
          return await requestJson(fetchImpl, options.userAgent, url, request);
        } catch (error) {
          if (!request.retry || !(error instanceof UpstreamError) || !error.retryable) throw error;
          await sleep(request.retry.delayMs);
          return requestJson(fetchImpl, options.userAgent, url, request);
        }
      });
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(
  fetchImpl: FetchLike,
  userAgent: string,
  url: string,
  request: JsonRequest,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    Accept: 'application/json',
    ...request.headers,
  };
  const init: RequestInit = { method: request.method ?? 'GET', headers };
  if (request.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(request.form).toString();
  }

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (cause) {
    throw new UpstreamError(request.service, `${request.service}: network failure`, {
      retryable: true,
      cause,
    });
  }

  if (!response.ok) {
    throw new UpstreamError(
      request.service,
      `${request.service}: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
      { retryable: RETRYABLE_STATUSES.has(response.status) },
    );
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new UpstreamError(request.service, `${request.service}: response was not JSON`, {
      retryable: true,
      cause,
    });
  }
}
