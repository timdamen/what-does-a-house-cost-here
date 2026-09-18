import { describe, expect, it } from 'vitest';

import {
  AMSTERDAM_CENTRE,
  createFixtureGeocoder,
  FIXTURE_SOURCE,
  SYDNEY_CENTRE,
} from '../src/index';

const FIXED_NOW = new Date('2026-09-17T10:00:00.000Z');
const geocoder = createFixtureGeocoder({ now: () => FIXED_NOW });

describe('fixture geocoder', () => {
  it('resolves Amsterdam and Sydney to the fixture centres', async () => {
    const amsterdam = await geocoder.search('Amsterdam');
    expect(amsterdam.data[0]).toMatchObject({ location: AMSTERDAM_CENTRE, countryCode: 'NL' });
    expect(amsterdam.provenance).toEqual({
      source: FIXTURE_SOURCE,
      fetchedAt: FIXED_NOW.toISOString(),
    });

    const sydney = await geocoder.search('sydney');
    expect(sydney.data[0]).toMatchObject({ location: SYDNEY_CENTRE, countryCode: 'AU' });
  });

  it('matches by prefix', async () => {
    const { data } = await geocoder.search('Ams');
    expect(data.map((place) => place.label)).toEqual(['Amsterdam, Noord-Holland, Nederland']);
  });

  it('resolves postcode-looking strings', async () => {
    const dutch = await geocoder.search('1017 ab');
    expect(dutch.data).toHaveLength(1);
    expect(dutch.data[0]).toMatchObject({
      label: '1017 AB, Amsterdam, Nederland',
      location: AMSTERDAM_CENTRE,
      countryCode: 'NL',
    });

    const australian = await geocoder.search('2000');
    expect(australian.data[0]).toMatchObject({ location: SYDNEY_CENTRE, countryCode: 'AU' });

    const british = await geocoder.search('SW1A 1AA');
    expect(british.data[0]).toMatchObject({ countryCode: 'GB' });
  });

  it('returns nothing for an empty or unknown query', async () => {
    expect((await geocoder.search('   ')).data).toEqual([]);
    expect((await geocoder.search('Atlantis')).data).toEqual([]);
  });
});
