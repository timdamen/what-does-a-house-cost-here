import { AMSTERDAM_CENTRE, haversineMetres } from '@house-cost/domain';
import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import {
  circlePolygon,
  houseFeatureCollection,
  houseLabel,
  pointCollection,
} from '../../app/utils/map/geojson';
import {
  appLayers,
  carryAppStyle,
  houseFilter,
  IMAGE_IDS,
  LAYER_IDS,
  LIGHT_PALETTE,
  pickTextFonts,
  pillStyleForImage,
  selectedFilter,
  SOURCE_IDS,
} from '../../app/utils/map/layers';
import { createPillImage, PILL_IMAGE_OPTIONS, PILL_SIZE } from '../../app/utils/map/pill';
import {
  RADIUS_OPTIONS,
  radiusLabel,
  shouldOfferSearchHere,
  zoomForRadius,
} from '../../app/utils/map/radius';
import { searchAreaSummary } from '../../app/utils/map/summary';
import type { MapHouse } from '../../app/utils/map/types';

const house = (id: string, overrides: Partial<MapHouse> = {}): MapHouse => ({
  id,
  location: { lat: 52.37, lng: 4.9 },
  address: { street: 'Herengracht', housenumber: '1' },
  buildingType: 'house',
  osmTags: {},
  ...overrides,
});

const signal = (houseId: string, amount: number, currency = 'EUR') => ({
  houseId,
  amount,
  currency,
  kind: 'sale' as const,
  date: '2025-01-01',
  scope: 'house' as const,
  source: 'fixture',
});

describe('radius helpers', () => {
  it('maps the fixed radius options to z16, z15 and z14', () => {
    expect(RADIUS_OPTIONS.map(zoomForRadius)).toEqual([16, 15, 14]);
  });

  it('rounds other radii to whole zoom levels and clamps the extremes', () => {
    expect(zoomForRadius(700)).toBe(15);
    expect(zoomForRadius(1)).toBe(18);
    expect(zoomForRadius(1_000_000)).toBe(10);
    expect(zoomForRadius(0)).toBe(15);
  });

  it('labels radii in metres below a kilometre', () => {
    expect(RADIUS_OPTIONS.map(radiusLabel)).toEqual(['250 m', '500 m', '1 km']);
    expect(radiusLabel(1500)).toBe('1.5 km');
  });

  it('offers "search here" after a few hundred metres, scaled for small radii', () => {
    expect(shouldOfferSearchHere(299, 1000)).toBe(false);
    expect(shouldOfferSearchHere(300, 1000)).toBe(true);
    expect(shouldOfferSearchHere(125, 250)).toBe(true);
    expect(shouldOfferSearchHere(100, 250)).toBe(false);
  });
});

describe('searchAreaSummary', () => {
  it('states the count, radius and centre at four decimals', () => {
    expect(searchAreaSummary(AMSTERDAM_CENTRE, 500, 122)).toBe(
      '122 houses within 500 m of 52.3676, 4.9041',
    );
    expect(searchAreaSummary({ lat: 1, lng: 2 }, 1000, 1)).toBe(
      '1 house within 1 km of 1.0000, 2.0000',
    );
  });
});

describe('house GeoJSON', () => {
  it('labels Houses with an abbreviated Price Signal in the given locale', () => {
    expect(houseLabel(house('a', { priceSignal: signal('a', 312_000) }), 'en-GB')).toBe('€312k');
    expect(houseLabel(house('a', { priceSignal: signal('a', 1_250_000, 'GBP') }), 'en-GB')).toBe(
      '£1.3M',
    );
    expect(houseLabel(house('a'), 'en-GB')).toBeNull();
    expect(houseLabel(house('a', { priceSignal: null }), 'en-GB')).toBeNull();
  });

  it('builds point features with id, label and hasPrice properties', () => {
    const collection = houseFeatureCollection(
      [house('way/1', { priceSignal: signal('way/1', 450_000) }), house('way/2')],
      'nl-NL',
    );

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [4.9, 52.37] },
      properties: { id: 'way/1', label: '€\u00a0450k', hasPrice: true },
    });
    expect(collection.features[1]?.properties).toEqual({
      id: 'way/2',
      label: null,
      hasPrice: false,
    });
  });

  it('draws the Search Area as a closed ring of points on the circle', () => {
    const polygon = circlePolygon(AMSTERDAM_CENTRE, 500, 32);
    const ring = polygon.geometry.coordinates[0] ?? [];

    expect(polygon.geometry.type).toBe('Polygon');
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
    for (const [lng, lat] of ring) {
      expect(haversineMetres(AMSTERDAM_CENTRE, { lat, lng })).toBeCloseTo(500, 0);
    }
  });

  it('wraps an optional Location as a one-point or empty collection', () => {
    expect(pointCollection(null).features).toEqual([]);
    expect(pointCollection({ lat: 1, lng: 2 }).features[0]?.geometry.coordinates).toEqual([2, 1]);
  });
});

describe('layer definitions', () => {
  it('splits Houses by price and keeps the selected one out of the ordinary layers', () => {
    expect(houseFilter(true, 'way/9')).toEqual([
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'hasPrice'], true],
      ['!=', ['get', 'id'], 'way/9'],
    ]);
    expect(selectedFilter(false, null)).toEqual([
      'all',
      ['!', ['has', 'point_count']],
      ['!=', ['get', 'hasPrice'], true],
      ['==', ['get', 'id'], ''],
    ]);
  });

  it('defines every layer in draw order over the app sources with the price label field', () => {
    const fonts = { regular: ['noto_sans_regular'], bold: ['noto_sans_bold'] };
    const layers = appLayers(LIGHT_PALETTE, fonts, null);

    expect(layers.map((layer) => layer.id)).toEqual(Object.values(LAYER_IDS));
    expect(new Set(layers.map((layer) => 'source' in layer && layer.source))).toEqual(
      new Set(Object.values(SOURCE_IDS)),
    );
    const priced = layers.find((layer) => layer.id === LAYER_IDS.housePriced);
    expect(priced?.type).toBe('symbol');
    expect(priced?.layout).toMatchObject({
      'text-field': ['get', 'label'],
      'text-font': ['noto_sans_bold'],
      'icon-image': IMAGE_IDS.pillLight,
      'icon-text-fit': 'both',
    });
  });

  it('reads the font stacks from the loaded style and falls back to Noto Sans', () => {
    const style = {
      version: 8,
      sources: {},
      layers: [
        { id: 'a', type: 'symbol', layout: { 'text-font': ['noto_sans_regular'] } },
        { id: 'b', type: 'symbol', layout: { 'text-font': ['noto_sans_bold'] } },
      ],
    } as unknown as StyleSpecification;

    expect(pickTextFonts(style)).toEqual({
      regular: ['noto_sans_regular'],
      bold: ['noto_sans_bold'],
    });
    expect(pickTextFonts(undefined)).toEqual({
      regular: ['Noto Sans Regular'],
      bold: ['Noto Sans Bold'],
    });
  });

  it('carries the app sources and layers into a swapped style', () => {
    const previous = {
      version: 8,
      sources: {
        base: { type: 'vector', url: 'old' },
        [SOURCE_IDS.houses]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [{ id: 'old-base', type: 'background' }],
    } as unknown as StyleSpecification;
    const next = {
      version: 8,
      sources: { base: { type: 'vector', url: 'new' } },
      layers: [{ id: 'new-base', type: 'background' }],
    } as unknown as StyleSpecification;
    const fonts = { regular: ['x'], bold: ['y'] };

    const merged = carryAppStyle(previous, next, appLayers(LIGHT_PALETTE, fonts, null));

    expect(Object.keys(merged.sources)).toEqual(['base', SOURCE_IDS.houses]);
    expect(merged.sources.base).toEqual({ type: 'vector', url: 'new' });
    expect(merged.layers[0]?.id).toBe('new-base');
    expect(merged.layers).toHaveLength(1 + Object.keys(LAYER_IDS).length);
  });
});

describe('pill image', () => {
  it('produces an opaque circle with the stroke on the rim and transparent corners', () => {
    const image = createPillImage({ fill: '#ffffff', stroke: '#0f766e' });
    const pixel = (x: number, y: number) => {
      const offset = (y * PILL_SIZE + x) * 4;
      return Array.from(image.data.slice(offset, offset + 4));
    };

    expect(image.width).toBe(PILL_SIZE);
    expect(image.height).toBe(PILL_SIZE);
    expect(pixel(0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(PILL_SIZE / 2, PILL_SIZE / 2)).toEqual([255, 255, 255, 255]);
    expect(pixel(PILL_SIZE / 2, 1)).toEqual([15, 118, 110, 255]);
  });

  it('stretches from the middle and keeps the pixel ratio at two', () => {
    expect(PILL_IMAGE_OPTIONS.pixelRatio).toBe(2);
    expect(PILL_IMAGE_OPTIONS.stretchX[0]?.[0]).toBeLessThan(PILL_SIZE / 2);
    expect(PILL_IMAGE_OPTIONS.stretchX[0]?.[1]).toBeGreaterThan(PILL_SIZE / 2);
    expect(PILL_IMAGE_OPTIONS.content[2]).toBeGreaterThan(PILL_IMAGE_OPTIONS.content[0]);
  });

  it('knows the style of each pill image id', () => {
    expect(pillStyleForImage(IMAGE_IDS.pillLight)).toEqual(LIGHT_PALETTE.pill);
    expect(pillStyleForImage('unknown')).toBeUndefined();
  });

  it('rejects colours that are not #rrggbb', () => {
    expect(() => createPillImage({ fill: 'white', stroke: '#000000' })).toThrow(/rrggbb/);
  });
});
