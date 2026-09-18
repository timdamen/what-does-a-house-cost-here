import type { Location } from '@house-cost/domain';
import { LOCATION_DECIMALS } from '@house-cost/domain';

import { radiusLabel } from './radius';

/** Text summary of the Search Area for the placeholder and the `aria-live` region. */
export function searchAreaSummary(
  centre: Location,
  radiusMetres: number,
  houseCount: number,
): string {
  const houses = houseCount === 1 ? '1 house' : `${houseCount} houses`;
  return `${houses} within ${radiusLabel(radiusMetres)} of ${formatCentre(centre)}`;
}

function formatCentre(centre: Location): string {
  return `${centre.lat.toFixed(LOCATION_DECIMALS)}, ${centre.lng.toFixed(LOCATION_DECIMALS)}`;
}

/**
 * Count-free description of the Search Area for the map placeholder. Its text never changes
 * while the map loads, so the paragraph painted with the server HTML stays the page's largest
 * contentful paint instead of being replaced when the house count arrives (ticket 13).
 */
export function searchAreaLabel(centre: Location, radiusMetres: number): string {
  return `Houses within ${radiusLabel(radiusMetres)} of ${formatCentre(centre)}`;
}
