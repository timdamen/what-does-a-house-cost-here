import type { Location } from '@house-cost/domain';
import { LOCATION_DECIMALS, roundLocation } from '@house-cost/domain';
import type { LocationQuery, LocationQueryValue } from 'vue-router';

/** Fixed Search Radius choices in metres (research note `docs/research/mobile-map-ux.md`, decision 1). */
export const RADIUS_OPTIONS = [250, 500, 1000] as const;
export type RadiusOption = (typeof RADIUS_OPTIONS)[number];
export const DEFAULT_RADIUS: RadiusOption = 500;

/** Query parameter names. The URL is the source of truth for Location, Search Radius and selection. */
const LAT = 'lat';
const LNG = 'lng';
const RADIUS = 'r';
const HOUSE = 'h';

function first(value: LocationQueryValue | LocationQueryValue[] | undefined): string | null {
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === 'string' && single.length > 0 ? single : null;
}

function parseCoordinate(value: string | null, max: number): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

export function parseLocation(query: LocationQuery): Location | null {
  const lat = parseCoordinate(first(query[LAT]), 90);
  const lng = parseCoordinate(first(query[LNG]), 180);
  return lat === null || lng === null ? null : roundLocation({ lat, lng });
}

export function parseRadius(query: LocationQuery): RadiusOption {
  const n = Number(first(query[RADIUS]));
  return RADIUS_OPTIONS.find((option) => option === n) ?? DEFAULT_RADIUS;
}

/**
 * Location, Search Radius and selected House, read from and written to the URL query.
 * Writes use `router.replace` so browsing history is not flooded; coordinates are rounded to
 * `LOCATION_DECIMALS` before they reach the URL (and therefore before they reach any server).
 */
export function useLocation() {
  const route = useRoute();
  const router = useRouter();

  const location = computed(() => parseLocation(route.query));
  const radius = computed(() => parseRadius(route.query));
  const selectedHouseId = computed(() => first(route.query[HOUSE]));

  async function replaceQuery(patch: Record<string, string | undefined>) {
    const query: LocationQuery = { ...route.query };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete query[key];
      else query[key] = value;
    }
    await router.replace({ query });
  }

  /** Moves the Location. Clears the selected House because it may fall outside the new area. */
  function setLocation(next: Location) {
    const rounded = roundLocation(next);
    return replaceQuery({
      [LAT]: rounded.lat.toFixed(LOCATION_DECIMALS),
      [LNG]: rounded.lng.toFixed(LOCATION_DECIMALS),
      [HOUSE]: undefined,
    });
  }

  function setRadius(next: RadiusOption) {
    return replaceQuery({ [RADIUS]: String(next) });
  }

  /** Selects a House by id, or clears the selection with `null`. */
  function select(houseId: string | null) {
    return replaceQuery({ [HOUSE]: houseId ?? undefined });
  }

  return {
    location,
    radius,
    radiusOptions: RADIUS_OPTIONS,
    selectedHouseId,
    setLocation,
    setRadius,
    select,
  };
}
