import { HOUSE_CAP, roundLocation, type HouseRef } from '@house-cost/domain';
import type { H3Event } from 'h3';
import { z } from 'zod';

/**
 * OSM address tags are free text (`addr:housenumber` can be "1-3, 5-7 and 9"), so over-long
 * fields are trimmed rather than rejected: one odd tag must not cost the whole area its prices.
 */
const addressField = (max: number) =>
  z
    .string()
    .transform((value) => value.trim().slice(0, max))
    .optional();

const addressSchema = z.object({
  street: addressField(200),
  housenumber: addressField(100),
  postcode: addressField(32),
  city: addressField(200),
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
