import type { Location } from '@house-cost/domain';
import { roundLocation } from '@house-cost/domain';

export type GeolocationStatus =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'error';

/** How long `locate()` waits for the browser before giving up. */
export const GEOLOCATION_TIMEOUT_MS = 10_000;

const STATE_KEY = 'geolocation';

/** One request at a time: a second `locate()` while one is in flight joins it. */
let inFlight: Promise<Location | null> | null = null;

function geolocationApi(): Geolocation | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.geolocation ?? null;
}

/**
 * Wraps `navigator.geolocation` in app-wide state so the prompt, the locate-me button and the map
 * all see the same status. Only the rounded Location leaves this composable; the precise
 * position is never kept and never sent anywhere.
 */
export function useGeolocation() {
  const status = useState<GeolocationStatus>(`${STATE_KEY}:status`, () => 'idle');
  const position = useState<Location | null>(`${STATE_KEY}:position`, () => null);

  /** Requests a single position. Resolves to the rounded Location, or `null` when unavailable. */
  function locate(): Promise<Location | null> {
    if (inFlight) return inFlight;

    const api = geolocationApi();
    if (!api) {
      status.value = 'unsupported';
      return Promise.resolve(null);
    }

    status.value = 'requesting';
    inFlight = new Promise<Location | null>((resolve) => {
      api.getCurrentPosition(
        (result) => {
          const rounded = roundLocation({
            lat: result.coords.latitude,
            lng: result.coords.longitude,
          });
          position.value = rounded;
          status.value = 'granted';
          resolve(rounded);
        },
        (failure) => {
          status.value = failure.code === failure.PERMISSION_DENIED ? 'denied' : 'error';
          resolve(null);
        },
        { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60_000 },
      );
    }).finally(() => {
      inFlight = null;
    });

    return inFlight;
  }

  return { status, position, locate };
}
