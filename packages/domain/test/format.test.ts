import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  formatPrice,
  formatPriceAbbreviated,
  localeForCountryCode,
} from '../src/index';

/** Intl inserts non-breaking spaces; normalise them so assertions read plainly. */
const plain = (value: string): string => value.replace(/[  ]/g, ' ');

describe('formatPrice', () => {
  it('formats whole units with the locale symbol and grouping', () => {
    expect(plain(formatPrice(312_500, 'EUR', 'nl-NL'))).toBe('€ 312.500');
    expect(plain(formatPrice(312_500, 'GBP', 'en-GB'))).toBe('£312,500');
    expect(plain(formatPrice(312_500, 'EUR', 'de-DE'))).toBe('312.500 €');
  });

  it('drops fractions', () => {
    expect(plain(formatPrice(312_500.75, 'EUR', 'en'))).toBe('€312,501');
  });
});

describe('formatPriceAbbreviated', () => {
  it('abbreviates thousands with k', () => {
    expect(plain(formatPriceAbbreviated(312_000, 'EUR', 'en'))).toBe('€312k');
    expect(plain(formatPriceAbbreviated(312_499, 'EUR', 'en'))).toBe('€312k');
    expect(plain(formatPriceAbbreviated(949_999, 'GBP', 'en-GB'))).toBe('£950k');
  });

  it('abbreviates millions with M and one decimal', () => {
    expect(plain(formatPriceAbbreviated(1_250_000, 'EUR', 'en'))).toBe('€1.3M');
    expect(plain(formatPriceAbbreviated(1_000_000, 'EUR', 'en'))).toBe('€1M');
    expect(plain(formatPriceAbbreviated(1_250_000, 'EUR', 'nl-NL'))).toBe('€ 1,3M');
  });

  it('keeps the locale symbol position', () => {
    expect(plain(formatPriceAbbreviated(312_000, 'EUR', 'de-DE'))).toBe('312k €');
    expect(plain(formatPriceAbbreviated(312_000, 'AUD', 'en-AU'))).toBe('$312k');
  });

  it('leaves small amounts unabbreviated', () => {
    expect(plain(formatPriceAbbreviated(950, 'EUR', 'en'))).toBe('€950');
  });
});

describe('localeForCountryCode', () => {
  it('maps known countries to their main locale', () => {
    expect(localeForCountryCode('NL')).toBe('nl-NL');
    expect(localeForCountryCode('gb')).toBe('en-GB');
    expect(localeForCountryCode('AU')).toBe('en-AU');
  });

  it('falls back to English with the region for unknown countries', () => {
    expect(localeForCountryCode('JP')).toBe('en-JP');
  });

  it('falls back to the default locale for missing or malformed codes', () => {
    expect(localeForCountryCode(undefined)).toBe(DEFAULT_LOCALE);
    expect(localeForCountryCode('')).toBe(DEFAULT_LOCALE);
    expect(localeForCountryCode('NLD')).toBe(DEFAULT_LOCALE);
  });
});
