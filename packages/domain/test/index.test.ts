import { describe, expect, it } from 'vitest';

import { DOMAIN_PACKAGE_NAME } from '../src/index';

describe('@house-cost/domain', () => {
  it('exposes its package name', () => {
    expect(DOMAIN_PACKAGE_NAME).toBe('@house-cost/domain');
  });
});
