import { formatPrice, formatPriceAbbreviated, localeForCountryCode } from '@house-cost/domain';

/** How distances are shown: metres and kilometres, or the imperial habits of the US and the UK. */
export type DistanceSystem = 'metric' | 'imperial-us' | 'imperial-uk';

const METRES_PER_MILE = 1609.344;
const METRES_PER_FOOT = 0.3048;
/** Below this the US reads feet rather than a fraction of a mile. */
const US_FEET_BELOW_METRES = METRES_PER_MILE / 5;
/** UK signage mixes metres for short walks with miles beyond about half a mile. */
const UK_METRES_BELOW_METRES = METRES_PER_MILE / 2;

export function distanceSystemFor(countryCode: string | undefined): DistanceSystem {
  switch (countryCode?.trim().toUpperCase()) {
    case 'US':
      return 'imperial-us';
    case 'GB':
      return 'imperial-uk';
    default:
      return 'metric';
  }
}

function unit(
  value: number,
  unitName: 'meter' | 'kilometer' | 'foot' | 'mile',
  locale: string,
  maximumFractionDigits: number,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: unitName,
    unitDisplay: 'short',
    maximumFractionDigits,
  }).format(value);
}

/**
 * A walking distance in the units the visitor expects: `450 m` / `1.2 km`, `1,300 ft` / `0.8 mi`
 * (US), `450 m` / `1.5 mi` (UK). Short distances are rounded to 10 units.
 */
export function formatDistance(metres: number, locale: string, system: DistanceSystem): string {
  const safe = Number.isFinite(metres) && metres >= 0 ? metres : 0;
  switch (system) {
    case 'imperial-us':
      if (safe < US_FEET_BELOW_METRES) {
        return unit(Math.round(safe / METRES_PER_FOOT / 10) * 10, 'foot', locale, 0);
      }
      return unit(safe / METRES_PER_MILE, 'mile', locale, 1);
    case 'imperial-uk':
      if (safe < UK_METRES_BELOW_METRES) {
        return unit(Math.round(safe / 10) * 10, 'meter', locale, 0);
      }
      return unit(safe / METRES_PER_MILE, 'mile', locale, 1);
    default:
      if (safe < 1000) return unit(Math.round(safe / 10) * 10, 'meter', locale, 0);
      return unit(safe / 1000, 'kilometer', locale, 1);
  }
}

/**
 * Currency and distance formatting for the country the Location is in (user story 46), derived
 * from `facts.hierarchy.countryCode`. Wraps the domain price helpers; before the facts arrive the
 * neutral `en` locale and metric units apply.
 */
export function useLocaleFormat(countryCode: MaybeRefOrGetter<string | undefined>) {
  const code = computed(() => toValue(countryCode));
  const locale = computed(() => localeForCountryCode(code.value));
  const distanceSystem = computed(() => distanceSystemFor(code.value));

  return {
    locale,
    distanceSystem,
    price: (amount: number, currency: string) => formatPrice(amount, currency, locale.value),
    priceAbbreviated: (amount: number, currency: string) =>
      formatPriceAbbreviated(amount, currency, locale.value),
    distance: (metres: number) => formatDistance(metres, locale.value, distanceSystem.value),
  };
}
