import { vi } from 'vitest';

/** `GeolocationPositionError` codes; happy-dom does not define the class. */
export const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
export const TIMEOUT = 3;

export type GeolocationOutcome =
  | { kind: 'granted'; lat: number; lng: number }
  | { kind: 'failed'; code: number };

/**
 * Replaces `navigator.geolocation` for one test. Returns the `getCurrentPosition` spy so tests
 * can assert on how often the browser was asked.
 */
export function stubGeolocation(outcome: GeolocationOutcome | 'unsupported') {
  const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success, failure) => {
    if (outcome === 'unsupported') return;
    if (outcome.kind === 'granted') {
      success({
        coords: { latitude: outcome.lat, longitude: outcome.lng },
        timestamp: Date.now(),
      } as GeolocationPosition);
    } else {
      failure?.({
        code: outcome.code,
        message: 'stubbed',
        PERMISSION_DENIED,
        POSITION_UNAVAILABLE,
        TIMEOUT,
      } as GeolocationPositionError);
    }
  });

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: outcome === 'unsupported' ? null : { getCurrentPosition },
  });

  return getCurrentPosition;
}
