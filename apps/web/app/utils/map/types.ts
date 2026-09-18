import type { House, Location, PriceSignal } from '@house-cost/domain';

/**
 * A House as the map draws it: the domain House plus the Price Signal the page merged in
 * (ticket 08 merges prices into `House.priceSignal` after they are fetched).
 */
export type MapHouse = House & { priceSignal?: PriceSignal | null };

/** Asks the map to ease its camera onto a House; a fresh object is a fresh request. */
export interface CentreRequest {
  houseId: string;
}

/** Props shared by `HouseMapFrame.vue` (SSR wrapper) and `HouseMap.client.vue` (the map). */
export interface HouseMapProps {
  centre: Location;
  radiusMetres: number;
  houses: MapHouse[];
  selectedHouseId?: string | null;
  /**
   * Set by a selection from the house list (user story 26): the map centres on that House.
   * A selection from the map itself only pans when the House is hidden.
   */
  centreOn?: CentreRequest | null;
  userPosition?: Location | null;
  amenityFocus?: Location | null;
  /** ISO 3166-1 alpha-2; picks the locale used for the price pills. */
  countryCode?: string;
  /** CSS length of the bottom sheet's peek; controls and attribution stack above it. */
  peekHeight?: string;
  /**
   * CSS length of the sheet's current height. The camera keeps what it reveals or centres above
   * it, so a half-open sheet never hides the House or Amenity just asked for. Defaults to the
   * peek.
   */
  sheetHeight?: string;
  /** Exposes `window.__houseMap` outside dev builds so browser tests can drive the map. */
  testHook?: boolean;
}

export type HouseMapStatus = 'loading' | 'ready' | 'error';

export interface HouseMapState {
  status: HouseMapStatus;
  centre: Location;
  zoom: number;
  radiusMetres: number;
  houseCount: number;
  selectedHouseId: string | null;
  searchHereVisible: boolean;
  theme: 'light' | 'dark';
}

/** Dev and browser-test hook installed on `window.__houseMap`. */
interface HouseMapTestHook {
  /** Behaves like a marker tap: emits `select` so the page scrolls the list. */
  select(houseId: string | null): void;
  getState(): HouseMapState;
}

declare global {
  interface Window {
    __houseMap?: HouseMapTestHook;
  }
}

/** What the map placeholder shows while `HouseMap` is not ready; `null` once the map is. */
export interface MapPlaceholderState {
  status: 'loading' | 'error';
  /** Extra line under the spinner, e.g. "Loading map (2/3)" or the failure message. */
  detail?: string;
}
