import { HOUSE_CAP, roundLocation, type HouseRef } from '@house-cost/domain';
import type { H3Event } from 'h3';
import { z } from 'zod';

const addressSchema = z.object({
  street: z.string().max(200).optional(),
  housenumber: z.string().max(20).optional(),
  postcode: z.string().max(20).optional(),
  city: z.string().max(200).optional(),
});

const bodySchema = z.object({
  houses: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        location: locationSchema,
        address: addressSchema.optional(),
      }),
    )
    .max(HOUSE_CAP),
});

const priceSignalsCached = defineCachedFunction(
  (event: H3Event, houses: HouseRef[]) => useDataProvider(event).getPriceSignals(houses),
  {
    name: 'prices',
    maxAge: ONE_DAY,
    getKey: (event, houses) =>
      cacheKey(
        event,
        digest(
          houses
            .map((house) => house.id)
            .toSorted()
            .join('\n'),
        ),
      ),
  },
);

/**
 * `POST /api/prices` with body `{ houses: Array<{ id, location, address? }> }`
 * -> `{ data: PriceSignal[], provenance }`. The body is exactly the `HouseRef` the port takes.
 * Signals carry `houseId` so the client can join them back; Houses without open price data
 * simply have no signal. Cached per set of house ids.
 */
export default defineApiHandler(async (event) => {
  const { houses } = parseOrReject(bodySchema, await readBody(event));

  const lookups: HouseRef[] = houses.map((house) => {
    const lookup: HouseRef = { id: house.id, location: roundLocation(house.location) };
    if (house.address) lookup.address = house.address;
    return lookup;
  });

  const result = await priceSignalsCached(event, lookups);
  setPublicCache(event, ONE_DAY);
  return result;
});
