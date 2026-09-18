import type { Location } from '@house-cost/domain';
import { formatPriceAbbreviated, offsetLocation } from '@house-cost/domain';

import type { MapHouse } from './types';

/** `[lng, lat]` as GeoJSON orders it (its "Position"; that word is the device dot's here). */
export type LngLat = [number, number];

export interface PointFeature<P> {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: LngLat };
  properties: P;
}

export interface PolygonFeature<P> {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: LngLat[][] };
  properties: P;
}

export interface FeatureCollection<F> {
  type: 'FeatureCollection';
  features: F[];
}

/** Properties MapLibre reads from each House feature. Clusters add `point_count` themselves. */
export interface HouseFeatureProperties {
  id: string;
  /** Abbreviated Price Signal (`€312k`), or `null` when the House has none. */
  label: string | null;
  hasPrice: boolean;
}

export function toLngLat(location: Location): LngLat {
  return [location.lng, location.lat];
}

/** Abbreviated price label for a House, or `null` without a Price Signal. */
export function houseLabel(house: MapHouse, locale: string): string | null {
  const signal = house.priceSignal;
  if (!signal) return null;
  return formatPriceAbbreviated(signal.amount, signal.currency, locale);
}

export function houseFeatureCollection(
  houses: readonly MapHouse[],
  locale: string,
): FeatureCollection<PointFeature<HouseFeatureProperties>> {
  return {
    type: 'FeatureCollection',
    features: houses.map((house) => {
      const label = houseLabel(house, locale);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: toLngLat(house.location) },
        properties: { id: house.id, label, hasPrice: label !== null },
      };
    }),
  };
}

const CIRCLE_STEPS = 64;

/** The Search Area as a closed polygon ring, built with the domain's `offsetLocation`. */
export function circlePolygon(
  centre: Location,
  radiusMetres: number,
  steps = CIRCLE_STEPS,
): PolygonFeature<Record<string, never>> {
  const ring: LngLat[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    const point = offsetLocation(
      centre,
      radiusMetres * Math.cos(angle),
      radiusMetres * Math.sin(angle),
    );
    ring.push(toLngLat(point));
  }
  ring.push(ring[0] as LngLat);
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {},
  };
}

export function pointCollection(
  location: Location | null | undefined,
): FeatureCollection<PointFeature<Record<string, never>>> {
  if (!location) return emptyCollection();
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: toLngLat(location) },
        properties: {},
      },
    ],
  };
}

function emptyCollection<F>(): FeatureCollection<F> {
  return { type: 'FeatureCollection', features: [] };
}
