import { describe, expect, it } from 'vitest';

import {
  boundingBox,
  haversineMetres,
  isWithinArea,
  offsetLocation,
  roundLocation,
  WALKING_DETOUR_FACTOR,
  WALKING_SPEED_METRES_PER_MINUTE,
  walkingMinutes,
} from '../src/index';

const AMSTERDAM = { lat: 52.3676, lng: 4.9041 };
const UTRECHT = { lat: 52.0907, lng: 5.1214 };

describe('haversineMetres', () => {
  it('is zero for the same point', () => {
    expect(haversineMetres(AMSTERDAM, AMSTERDAM)).toBe(0);
  });

  it('measures Amsterdam to Utrecht at about 34 km', () => {
    const metres = haversineMetres(AMSTERDAM, UTRECHT);
    expect(metres).toBeGreaterThan(33_500);
    expect(metres).toBeLessThan(34_500);
  });

  it('is symmetric', () => {
    expect(haversineMetres(AMSTERDAM, UTRECHT)).toBeCloseTo(haversineMetres(UTRECHT, AMSTERDAM), 6);
  });
});

describe('walkingMinutes', () => {
  it('uses the named speed and detour constants', () => {
    expect(WALKING_SPEED_METRES_PER_MINUTE).toBe(80);
    expect(WALKING_DETOUR_FACTOR).toBe(1.3);
    expect(walkingMinutes(800)).toBe(13);
  });

  it('rounds up to whole minutes and never goes below zero', () => {
    expect(walkingMinutes(1)).toBe(1);
    expect(walkingMinutes(0)).toBe(0);
    expect(walkingMinutes(-50)).toBe(0);
    expect(walkingMinutes(Number.NaN)).toBe(0);
  });
});

describe('boundingBox', () => {
  it('contains the circle and is wider in longitude than latitude away from the equator', () => {
    const box = boundingBox({ centre: AMSTERDAM, radiusMetres: 500 });
    expect(box.south).toBeLessThan(AMSTERDAM.lat);
    expect(box.north).toBeGreaterThan(AMSTERDAM.lat);
    expect(box.west).toBeLessThan(AMSTERDAM.lng);
    expect(box.east).toBeGreaterThan(AMSTERDAM.lng);
    expect(box.east - box.west).toBeGreaterThan(box.north - box.south);

    const north = offsetLocation(AMSTERDAM, 0, 500);
    const east = offsetLocation(AMSTERDAM, 500, 0);
    expect(north.lat).toBeLessThanOrEqual(box.north + 1e-9);
    expect(east.lng).toBeLessThanOrEqual(box.east + 1e-9);
  });

  it('clamps to the poles', () => {
    const box = boundingBox({ centre: { lat: 89.999, lng: 0 }, radiusMetres: 10_000 });
    expect(box.north).toBe(90);
  });
});

describe('isWithinArea', () => {
  it('includes points inside the radius and excludes those outside', () => {
    const area = { centre: AMSTERDAM, radiusMetres: 500 };
    expect(isWithinArea(offsetLocation(AMSTERDAM, 300, 300), area)).toBe(true);
    expect(isWithinArea(offsetLocation(AMSTERDAM, 400, 400), area)).toBe(false);
  });
});

describe('roundLocation', () => {
  it('rounds to 4 decimals by default', () => {
    expect(roundLocation({ lat: 52.36761234, lng: 4.90405678 })).toEqual({
      lat: 52.3676,
      lng: 4.9041,
    });
  });

  it('accepts another precision', () => {
    expect(roundLocation({ lat: 52.36761234, lng: 4.90405678 }, 2)).toEqual({
      lat: 52.37,
      lng: 4.9,
    });
  });
});

describe('offsetLocation', () => {
  it('moves by the requested metres', () => {
    const moved = offsetLocation(AMSTERDAM, 300, -400);
    expect(haversineMetres(AMSTERDAM, moved)).toBeCloseTo(500, 0);
    expect(moved.lng).toBeGreaterThan(AMSTERDAM.lng);
    expect(moved.lat).toBeLessThan(AMSTERDAM.lat);
  });
});
