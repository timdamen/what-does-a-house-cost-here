import { createHash } from 'node:crypto';

import {
  DEFAULT_RADIUS_METRES,
  isUpstreamError,
  type UpstreamErrorShape,
} from '@house-cost/domain';
import type { EventHandler, EventHandlerRequest, H3Event } from 'h3';
import { z } from 'zod';

/** Server cache TTLs in seconds; the same values go out as `Cache-Control: max-age`. */
export const SIX_HOURS = 6 * 60 * 60;
export const ONE_DAY = 24 * 60 * 60;

export interface ValidationIssue {
  path: string[];
  message: string;
}

/** Body of every non-2xx response from `/api/*`. */
export type ApiErrorBody =
  | { error: UpstreamErrorShape }
  | { error: { kind: 'validation'; message: string; issues: ValidationIssue[] } };

class ValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super('Invalid request');
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/** Parses `input` with `schema`; a failure becomes a 400 through `defineApiHandler`. */
export function parseOrReject<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError(
    result.error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message })),
  );
}

/** A query-string number: `z.coerce.number()` would turn `''` into `0`, so require text first. */
function queryNumber(): z.ZodPipe<z.ZodString, z.ZodCoercedNumber<string>> {
  return z.string().min(1).pipe(z.coerce.number<string>());
}

export const latitudeSchema = queryNumber().pipe(z.number().min(-90).max(90));
export const longitudeSchema = queryNumber().pipe(z.number().min(-180).max(180));
/** Search Radius in metres. The UI offers 250, 500 and 1000; the API tolerates any sane integer. */
export const radiusSchema = queryNumber()
  .pipe(z.number().int().min(50).max(5000))
  .default(DEFAULT_RADIUS_METRES);

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Wraps a route handler so its failures become the API error envelope:
 * `UpstreamError` -> 502 `{ error: { kind: 'upstream', service, retryable } }`,
 * validation -> 400 `{ error: { kind: 'validation', message, issues } }`.
 * Anything else propagates to Nitro's default 500 handling.
 *
 * The declared response type stays `T`: `$fetch` and `useFetch` reject on non-2xx, so callers
 * only ever see the envelope as `FetchError.data`, never as a resolved value.
 */
export function defineApiHandler<T>(
  handler: (event: H3Event) => Promise<T>,
): EventHandler<EventHandlerRequest, Promise<T>> {
  const wrapped = defineEventHandler(async (event): Promise<T | ApiErrorBody> => {
    try {
      return await handler(event);
    } catch (error) {
      return respondWithError(event, error);
    }
  });
  return wrapped as EventHandler<EventHandlerRequest, Promise<T>>;
}

function respondWithError(event: H3Event, error: unknown): ApiErrorBody {
  if (error instanceof ValidationError) {
    setResponseStatus(event, 400, 'Bad Request');
    return { error: { kind: 'validation', message: error.message, issues: error.issues } };
  }
  if (isUpstreamError(error)) {
    const captured =
      error instanceof Error ? error : new Error(`Upstream failure: ${error.service}`);
    useNitroApp().captureError(captured, { event, tags: ['api', 'upstream'] });
    setResponseStatus(event, 502, 'Bad Gateway');
    return {
      error: { kind: 'upstream', service: error.service, retryable: error.retryable },
    };
  }
  throw error;
}

/** Tells browsers and CDNs to keep a successful response as long as the server cache does. */
export function setPublicCache(event: H3Event, maxAgeSeconds: number): void {
  setResponseHeader(
    event,
    'Cache-Control',
    `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
  );
}

/**
 * Cache key for a route's `defineCachedFunction`: the provider name first, so switching providers
 * never serves another provider's results, then the parts the route is keyed on.
 */
export function cacheKey(event: H3Event, ...parts: Array<string | number>): string {
  return [providerName(event), ...parts].join(':');
}

/** Short stable digest for cache keys built from free text or long id lists. */
export function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}
