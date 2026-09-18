import { describe, expect, it } from 'vitest';

import { distanceSystemFor, formatDistance } from '../../app/composables/useLocaleFormat';

describe('useLocaleFormat helpers', () => {
  it('picks imperial habits for the US and the UK and metric elsewhere', () => {
    expect(distanceSystemFor('US')).toBe('imperial-us');
    expect(distanceSystemFor('gb')).toBe('imperial-uk');
    expect(distanceSystemFor('NL')).toBe('metric');
    expect(distanceSystemFor(undefined)).toBe('metric');
  });

  it('formats metric distances as metres then kilometres', () => {
    expect(formatDistance(447, 'nl-NL', 'metric')).toBe('450 m');
    expect(formatDistance(1650, 'en', 'metric')).toBe('1.7 km');
  });

  it('formats US distances as feet then miles and UK ones as metres then miles', () => {
    expect(formatDistance(150, 'en-US', 'imperial-us')).toBe('490 ft');
    expect(formatDistance(2500, 'en-US', 'imperial-us')).toBe('1.6 mi');
    expect(formatDistance(447, 'en-GB', 'imperial-uk')).toBe('450 m');
    expect(formatDistance(2500, 'en-GB', 'imperial-uk')).toBe('1.6 mi');
  });
});
