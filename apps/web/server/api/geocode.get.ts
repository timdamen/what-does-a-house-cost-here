import type { H3Event } from 'h3';
import { z } from 'zod';

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
});

const geocodeCached = defineCachedFunction(
  (event: H3Event, query: string) => useGeocoder(event).search(query),
  {
    name: 'geocode',
    maxAge: ONE_DAY,
    getKey: (event, query) => cacheKey(event, digest(query.toLowerCase())),
  },
);

/** `GET /api/geocode?q` -> `{ data: GeocodeResult[], provenance }`; no matches is `data: []`. */
export default defineApiHandler(async (event) => {
  const { q } = parseOrReject(querySchema, getQuery(event));

  const result = await geocodeCached(event, q);
  setPublicCache(event, ONE_DAY);
  return result;
});
