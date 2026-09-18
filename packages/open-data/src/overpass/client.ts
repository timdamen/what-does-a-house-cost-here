import { UpstreamError, type Location } from '@house-cost/domain';

import type { HttpClient } from '../http-client';

/** Public Overpass instance. Configurable so a mirror or self-hosted instance can replace it. */
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** `provenance.source` for data that came from Overpass. */
export const OVERPASS_SOURCE = 'openstreetmap-overpass';

/** `UpstreamError.service` for Overpass failures. */
export const OVERPASS_SERVICE = 'overpass';

/** Server-side query timeout. The public instance defaults to 180 s; we ask for much less. */
const OVERPASS_TIMEOUT_SECONDS = 25;

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  /** Present on ways and relations when the query ends in `out center`. */
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Overpass QL header shared by every query. */
export function overpassHeader(): string {
  return `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];`;
}

/** The `(around:radius,lat,lon)` spatial filter for a Search Area. */
export function aroundFilter(centre: Location, radiusMetres: number): string {
  return `(around:${Math.round(radiusMetres)},${centre.lat},${centre.lng})`;
}

/** Stable, OSM-shaped id such as `way/123`. */
export function elementId(element: OverpassElementLike): string {
  return `${element.type}/${element.id}`;
}

type OverpassElementLike = Pick<OverpassElement, 'type' | 'id'>;

/** Coordinates of a node, or the centre of a way/relation. `undefined` when neither is present. */
export function elementLocation(element: OverpassElement): Location | undefined {
  if (element.type === 'node' && isFiniteNumber(element.lat) && isFiniteNumber(element.lon)) {
    return { lat: element.lat, lng: element.lon };
  }
  const centre = element.center;
  if (centre && isFiniteNumber(centre.lat) && isFiniteNumber(centre.lon)) {
    return { lat: centre.lat, lng: centre.lon };
  }
  return undefined;
}

/** POSTs an Overpass QL query and returns its elements, validating the response shape. */
export async function runOverpassQuery(
  client: HttpClient,
  url: string,
  query: string,
): Promise<OverpassElement[]> {
  const body = await client.json(url, {
    service: OVERPASS_SERVICE,
    method: 'POST',
    form: { data: query },
  });
  return parseOverpassResponse(body);
}

/**
 * Narrows an Overpass JSON body to its elements. A `remark` beginning with `runtime error`
 * (timeouts, memory limits) means the query did not complete and is reported as retryable.
 */
function parseOverpassResponse(body: unknown): OverpassElement[] {
  if (!isRecord(body) || !Array.isArray(body.elements)) {
    throw new UpstreamError(OVERPASS_SERVICE, 'overpass: unexpected response shape', {
      retryable: false,
    });
  }
  if (typeof body.remark === 'string' && /runtime error/i.test(body.remark)) {
    throw new UpstreamError(OVERPASS_SERVICE, `overpass: ${body.remark}`, { retryable: true });
  }
  return body.elements.filter(isOverpassElement);
}

function isOverpassElement(value: unknown): value is OverpassElement {
  if (!isRecord(value)) return false;
  const type = value.type;
  return (type === 'node' || type === 'way' || type === 'relation') && isFiniteNumber(value.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
