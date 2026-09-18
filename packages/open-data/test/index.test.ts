import { describe, expect, it } from 'vitest';

import { IMPLEMENTS_PORT_FROM, OPEN_DATA_PACKAGE_NAME } from '../src/index';

describe('@house-cost/open-data', () => {
  it('exposes its package name', () => {
    expect(OPEN_DATA_PACKAGE_NAME).toBe('@house-cost/open-data');
  });

  it('resolves the domain workspace package through its exports map', () => {
    expect(IMPLEMENTS_PORT_FROM).toBe('@house-cost/domain');
  });
});
