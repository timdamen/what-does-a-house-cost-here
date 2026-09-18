import type { BuildingType, House, HousingMix } from './types';
import { BUILDING_TYPES } from './types';

/** Counts Houses per building type, with every type present (zero when absent). */
export function countHousingMix(houses: readonly House[]): HousingMix {
  const mix = Object.fromEntries(BUILDING_TYPES.map((type) => [type, 0])) as HousingMix;
  for (const house of houses) {
    mix[house.buildingType] += 1;
  }
  return mix;
}

/** Whether a string is one of the fixed building types. */
export function isBuildingType(value: string): value is BuildingType {
  return (BUILDING_TYPES as readonly string[]).includes(value);
}
