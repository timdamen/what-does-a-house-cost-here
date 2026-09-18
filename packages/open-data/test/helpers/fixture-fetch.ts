import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { haversineMetres, type Location } from '@house-cost/domain';

import type { FetchLike } from '../../src/http-client';

/** Envelope written by `scripts/record-fixtures.ts`. */
export interface Fixture {
  recordedAt: string;
  request: { method: 'GET' | 'POST'; url: string; form?: Record<string, string> };
  response: unknown;
  trimmed?: { elementsBefore: number; elementsAfter: number };
}

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/** Loads one recorded fixture by file name (without `.json`). */
export function loadFixture(name: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf8')) as Fixture;
}

function loadAllFixtures(): Map<string, Fixture> {
  const fixtures = new Map<string, Fixture>();
  for (const file of readdirSync(FIXTURES_DIR)) {
    if (file.endsWith('.json')) fixtures.set(file.slice(0, -5), loadFixture(file.slice(0, -5)));
  }
  return fixtures;
}

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

export interface FixtureFetch extends FetchLike {
  /** Every request the stub received, in order. */
  readonly calls: RecordedCall[];
}

export interface FixtureFetchOptions {
  /**
   * Land Registry requests for postcodes without a recorded fixture get an empty result page
   * (the register simply has nothing for them). `false` makes them throw like any unknown URL.
   */
  emptyLandRegistryForUnknownPostcodes?: boolean;
}

/** Overpass fixtures match on the query's centre, radius and kind; reverse fixtures on centre. */
const OVERPASS_CENTRE_TOLERANCE_METRES = 50;
const REVERSE_CENTRE_TOLERANCE_METRES = 2000;

/**
 * A `fetch` stub that serves the recorded fixtures and throws on anything else, so no test can
 * reach the network. Every request must carry a `User-Agent`, proving it went through the HTTP
 * client.
 */
export function createFixtureFetch(options: FixtureFetchOptions = {}): FixtureFetch {
  const fixtures = [...loadAllFixtures().entries()];
  const calls: RecordedCall[] = [];
  const emptyLandRegistry = options.emptyLandRegistryForUnknownPostcodes ?? true;

  const fetchStub = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (!headerValue(init, 'user-agent')) {
      throw new Error(`fixture fetch: request without User-Agent: ${url}`);
    }
    const fixture = match(fixtures, url, init, emptyLandRegistry);
    if (!fixture) throw new Error(`fixture fetch: no recorded fixture for ${url}`);
    return jsonResponse(fixture.response);
  };

  return Object.assign(fetchStub, { calls });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function match(
  fixtures: Array<[string, Fixture]>,
  url: string,
  init: RequestInit | undefined,
  emptyLandRegistry: boolean,
): Fixture | undefined {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/api/interpreter')) return matchOverpass(fixtures, init);
  if (parsed.pathname.endsWith('/reverse')) return matchReverse(fixtures, parsed);
  if (parsed.pathname.endsWith('/search')) {
    const query = parsed.searchParams.get('q')?.toLowerCase();
    return fixtures.find(
      ([name, fixture]) =>
        name.startsWith('nominatim-search-') &&
        new URL(fixture.request.url).searchParams.get('q')?.toLowerCase() === query,
    )?.[1];
  }
  if (parsed.pathname.endsWith('/transaction-record.json')) {
    const postcode = parsed.searchParams.get('propertyAddress.postcode');
    const hit = fixtures.find(
      ([name, fixture]) =>
        name.startsWith('land-registry-') &&
        new URL(fixture.request.url).searchParams.get('propertyAddress.postcode') === postcode,
    )?.[1];
    if (hit || !emptyLandRegistry) return hit;
    return emptyLandRegistryPage(fixtures, url);
  }
  return undefined;
}

function matchOverpass(
  fixtures: Array<[string, Fixture]>,
  init: RequestInit | undefined,
): Fixture | undefined {
  const query = new URLSearchParams(String(init?.body ?? '')).get('data') ?? '';
  const wanted = describeOverpassQuery(query);
  if (!wanted) return undefined;
  let best: { fixture: Fixture; distance: number } | undefined;
  for (const [name, fixture] of fixtures) {
    if (!name.startsWith('overpass-')) continue;
    const recorded = describeOverpassQuery(fixture.request.form?.data ?? '');
    if (!recorded || recorded.kind !== wanted.kind || recorded.radius !== wanted.radius) continue;
    const distance = haversineMetres(recorded.centre, wanted.centre);
    if (distance <= OVERPASS_CENTRE_TOLERANCE_METRES && (!best || distance < best.distance)) {
      best = { fixture, distance };
    }
  }
  return best?.fixture;
}

function matchReverse(fixtures: Array<[string, Fixture]>, parsed: URL): Fixture | undefined {
  const wanted = {
    lat: Number(parsed.searchParams.get('lat')),
    lng: Number(parsed.searchParams.get('lon')),
  };
  let best: { fixture: Fixture; distance: number } | undefined;
  for (const [name, fixture] of fixtures) {
    if (!name.startsWith('nominatim-reverse-')) continue;
    const recorded = new URL(fixture.request.url).searchParams;
    const centre = { lat: Number(recorded.get('lat')), lng: Number(recorded.get('lon')) };
    const distance = haversineMetres(centre, wanted);
    if (distance <= REVERSE_CENTRE_TOLERANCE_METRES && (!best || distance < best.distance)) {
      best = { fixture, distance };
    }
  }
  return best?.fixture;
}

interface OverpassQueryShape {
  kind: 'houses' | 'amenities';
  centre: Location;
  radius: number;
}

function describeOverpassQuery(query: string): OverpassQueryShape | undefined {
  const around = /around:(\d+),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(query);
  if (!around) return undefined;
  return {
    kind: query.includes('"building"') ? 'houses' : 'amenities',
    radius: Number(around[1]),
    centre: { lat: Number(around[2]), lng: Number(around[3]) },
  };
}

/** An empty Elda result page shaped like the recorded ones. */
function emptyLandRegistryPage(fixtures: Array<[string, Fixture]>, url: string): Fixture {
  const template = fixtures.find(([name]) => name.startsWith('land-registry-'))?.[1];
  const body = (template?.response ?? { format: 'linked-data-api', version: '0.2' }) as Record<
    string,
    unknown
  >;
  const result = (body.result ?? {}) as Record<string, unknown>;
  return {
    recordedAt: template?.recordedAt ?? new Date(0).toISOString(),
    request: { method: 'GET', url },
    response: {
      ...body,
      result: { ...result, _about: url, items: [], itemsPerPage: 100, page: 0, startIndex: 1 },
    },
  };
}

function headerValue(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers;
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === name)?.[1];
  }
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
}
