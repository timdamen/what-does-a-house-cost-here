/* oxlint-disable no-console, no-await-in-loop -- a hand-run recording script; sequential requests are the point */
/**
 * Records the upstream responses the tests replay from `test/fixtures/`. This is the only code in
 * the package that touches the network, and it is run by hand, rarely:
 *
 *   node scripts/record-fixtures.ts            (Node 24, no build step)
 *
 * One request per endpoint and area, sequential, with a pause between calls and an identifying
 * User-Agent. The Overpass queries are copied verbatim from `src/overpass/*.ts`; a test asserts
 * they still match, so changing a query means re-recording.
 *
 * Each fixture is an envelope `{ recordedAt, request, response, trimmed? }`. Overpass element
 * arrays are trimmed to keep files under `MAX_FIXTURE_BYTES`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const USER_AGENT =
  'what-does-a-house-cost-here-dev/0.0.0 (+https://github.com/timdamen/what-does-a-house-cost-here)';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const LAND_REGISTRY_URL = 'https://landregistry.data.gov.uk/data/ppi/transaction-record.json';

const HOUSE_CAP = 300;
const RECORD_RADIUS_METRES = 250;
const MAX_FIXTURE_BYTES = 300_000;
const PAUSE_MS = 1500;

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');

interface Location {
  lat: number;
  lng: number;
}

const AREAS = {
  islington: { lat: 51.5385, lng: -0.1025 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
} as const satisfies Record<string, Location>;

/** The contract test's "nothing here" area. */
const NOWHERE = { centre: { lat: 0, lng: 0 }, radiusMetres: 100 };

// ---- Overpass QL, copied from src/overpass/client.ts, houses.ts and amenities.ts ----

const OVERPASS_TIMEOUT_SECONDS = 25;
const RESIDENTIAL_BUILDING_VALUES = [
  'house',
  'detached',
  'semidetached_house',
  'terrace',
  'apartments',
  'residential',
  'bungalow',
];
const HEALTHCARE_AMENITIES = ['doctors', 'hospital', 'pharmacy', 'clinic'];
const RAILWAY_STOPS = ['station', 'halt', 'tram_stop'];
const PUBLIC_TRANSPORT = ['stop_position', 'platform'];

function overpassHeader(): string {
  return `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];`;
}

function aroundFilter(centre: Location, radiusMetres: number): string {
  return `(around:${Math.round(radiusMetres)},${centre.lat},${centre.lng})`;
}

function buildHousesQuery(centre: Location, radiusMetres: number, limit: number): string {
  const values = RESIDENTIAL_BUILDING_VALUES.join('|');
  return [
    overpassHeader(),
    `nwr["building"~"^(${values})$"]${aroundFilter(centre, radiusMetres)};`,
    `out center tags ${limit};`,
  ].join('\n');
}

function buildAmenitiesQuery(centre: Location, radiusMetres: number): string {
  const around = aroundFilter(centre, radiusMetres);
  return [
    overpassHeader(),
    '(',
    `  nwr["amenity"="school"]${around};`,
    `  nwr["shop"="supermarket"]${around};`,
    `  nwr["amenity"~"^(${HEALTHCARE_AMENITIES.join('|')})$"]${around};`,
    `  nwr["leisure"="park"]${around};`,
    `  node["highway"="bus_stop"]${around};`,
    `  nwr["railway"~"^(${RAILWAY_STOPS.join('|')})$"]${around};`,
    `  node["public_transport"~"^(${PUBLIC_TRANSPORT.join('|')})$"]${around};`,
    ');',
    'out center tags;',
  ].join('\n');
}

// ---- recording ----

interface RecordedRequest {
  method: 'GET' | 'POST';
  url: string;
  form?: Record<string, string>;
}

interface Fixture {
  recordedAt: string;
  request: RecordedRequest;
  response: unknown;
  trimmed?: { elementsBefore: number; elementsAfter: number };
}

async function request(recorded: RecordedRequest): Promise<Fixture> {
  const init: RequestInit = {
    method: recorded.method,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  };
  if (recorded.form) {
    init.headers = { ...init.headers, 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams(recorded.form).toString();
  }
  console.log(`${recorded.method} ${recorded.url}`);
  const response = await fetch(recorded.url, init);
  if (!response.ok) {
    throw new Error(`${recorded.url} -> HTTP ${response.status} ${await response.text()}`);
  }
  return {
    recordedAt: new Date().toISOString(),
    request: recorded,
    response: await response.json(),
  };
}

function trimOverpass(fixture: Fixture): Fixture {
  const body = fixture.response as { elements?: unknown[] };
  if (!Array.isArray(body.elements)) return fixture;
  const before = body.elements.length;
  let elements = body.elements;
  while (
    Buffer.byteLength(JSON.stringify({ ...fixture, response: { ...body, elements } })) >
    MAX_FIXTURE_BYTES
  ) {
    elements = elements.slice(0, Math.floor(elements.length * 0.8));
  }
  if (elements.length === before) return fixture;
  return {
    ...fixture,
    response: { ...body, elements },
    trimmed: { elementsBefore: before, elementsAfter: elements.length },
  };
}

async function save(name: string, fixture: Fixture): Promise<void> {
  const path = join(FIXTURES_DIR, `${name}.json`);
  const json = `${JSON.stringify(fixture, null, 2)}\n`;
  await writeFile(path, json);
  console.log(`  -> ${path} (${Buffer.byteLength(json)} bytes)`);
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

async function overpass(name: string, query: string): Promise<Fixture> {
  const fixture = trimOverpass(
    await request({ method: 'POST', url: OVERPASS_URL, form: { data: query } }),
  );
  await save(name, fixture);
  await pause();
  return fixture;
}

async function nominatim(
  name: string,
  path: string,
  params: Record<string, string>,
): Promise<void> {
  const url = `${NOMINATIM_URL}/${path}?${new URLSearchParams(params)}`;
  await save(name, await request({ method: 'GET', url }));
  await pause();
}

async function landRegistry(postcode: string): Promise<void> {
  const params = new URLSearchParams({
    'propertyAddress.postcode': postcode,
    _pageSize: '100',
    _sort: '-transactionDate',
  });
  const name = `land-registry-${postcode.toLowerCase().replace(/\s+/g, '-')}`;
  await save(name, await request({ method: 'GET', url: `${LAND_REGISTRY_URL}?${params}` }));
  await pause();
}

/** Postcodes of the recorded Islington Houses, most frequent first. */
function topPostcodes(fixture: Fixture, count: number): string[] {
  const body = fixture.response as { elements: Array<{ tags?: Record<string, string> }> };
  const counts = new Map<string, number>();
  for (const element of body.elements) {
    const postcode = element.tags?.['addr:postcode']?.trim().toUpperCase().replace(/\s+/g, ' ');
    if (postcode) counts.set(postcode, (counts.get(postcode) ?? 0) + 1);
  }
  return [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([postcode]) => postcode);
}

async function main(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true });

  const islingtonHouses = await overpass(
    'overpass-houses-islington',
    buildHousesQuery(AREAS.islington, RECORD_RADIUS_METRES, HOUSE_CAP + 1),
  );
  await overpass(
    'overpass-houses-amsterdam',
    buildHousesQuery(AREAS.amsterdam, RECORD_RADIUS_METRES, HOUSE_CAP + 1),
  );
  await overpass(
    'overpass-houses-nowhere',
    buildHousesQuery(NOWHERE.centre, NOWHERE.radiusMetres, HOUSE_CAP + 1),
  );
  await overpass(
    'overpass-amenities-islington',
    buildAmenitiesQuery(AREAS.islington, RECORD_RADIUS_METRES),
  );
  await overpass(
    'overpass-amenities-amsterdam',
    buildAmenitiesQuery(AREAS.amsterdam, RECORD_RADIUS_METRES),
  );

  for (const [name, centre] of Object.entries(AREAS)) {
    await nominatim(`nominatim-reverse-${name}`, 'reverse', {
      lat: String(centre.lat),
      lon: String(centre.lng),
      format: 'jsonv2',
      zoom: '16',
      addressdetails: '1',
    });
  }
  await nominatim('nominatim-search-amsterdam', 'search', {
    q: 'Amsterdam',
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
  });

  const postcodes = topPostcodes(islingtonHouses, 2);
  console.log(`Islington postcodes with the most Houses: ${postcodes.join(', ')}`);
  for (const postcode of postcodes) await landRegistry(postcode);
}

await main();
