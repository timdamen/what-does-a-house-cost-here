/**
 * Price and locale formatting. Everything goes through `Intl.NumberFormat` so symbols, grouping
 * and symbol position follow the locale rather than hard-coded rules.
 */

const LOCALE_BY_COUNTRY: Record<string, string> = {
  AT: 'de-AT',
  AU: 'en-AU',
  BE: 'nl-BE',
  CA: 'en-CA',
  CH: 'de-CH',
  DE: 'de-DE',
  DK: 'da-DK',
  ES: 'es-ES',
  FI: 'fi-FI',
  FR: 'fr-FR',
  GB: 'en-GB',
  IE: 'en-IE',
  IT: 'it-IT',
  NL: 'nl-NL',
  NO: 'nb-NO',
  NZ: 'en-NZ',
  PL: 'pl-PL',
  PT: 'pt-PT',
  SE: 'sv-SE',
  US: 'en-US',
};

export const DEFAULT_LOCALE = 'en';

/**
 * BCP 47 locale for a country code. Known countries map to their main locale; unknown ones get
 * English with the country as region (`en-XX`) so number formatting still follows local habits.
 */
export function localeForCountryCode(countryCode: string | undefined): string {
  if (!countryCode) return DEFAULT_LOCALE;
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return DEFAULT_LOCALE;
  return LOCALE_BY_COUNTRY[code] ?? `en-${code}`;
}

/** Full price, whole units, e.g. `€ 312.500` (nl-NL) or `£312,500` (en-GB). */
export function formatPrice(amount: number, currency: string, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Abbreviated price for map markers, e.g. `€312k`, `€1.2M`, `£950k`. The number is abbreviated
 * with `k` and `M` regardless of locale; the currency symbol and its position come from the locale.
 */
export function formatPriceAbbreviated(
  amount: number,
  currency: string,
  locale = DEFAULT_LOCALE,
): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).formatToParts(amount);

  const abbreviated = abbreviateNumber(Math.abs(amount), locale);

  // Grouped numbers come back as several `integer` parts; the first one becomes the abbreviation
  // and every other numeric part is dropped, leaving symbol, sign and spacing as the locale set.
  let replaced = false;
  return parts
    .map((part) => {
      if (part.type === 'integer') {
        if (replaced) return '';
        replaced = true;
        return abbreviated;
      }
      if (part.type === 'group' || part.type === 'decimal' || part.type === 'fraction') return '';
      return part.value;
    })
    .join('');
}

function abbreviateNumber(value: number, locale: string): string {
  if (value >= 1_000_000) {
    const millions = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
      value / 1_000_000,
    );
    return `${millions}M`;
  }
  if (value >= 1_000) {
    const thousands = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
      value / 1_000,
    );
    return `${thousands}k`;
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}
