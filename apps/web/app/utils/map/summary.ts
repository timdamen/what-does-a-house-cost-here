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
