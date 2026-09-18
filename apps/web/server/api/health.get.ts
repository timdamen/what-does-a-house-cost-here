import { DOMAIN_PACKAGE_NAME } from '@house-cost/domain';
import { OPEN_DATA_PACKAGE_NAME } from '@house-cost/open-data';

/**
 * Liveness probe. Also proves the workspace packages are bundled into the server build.
 */
export default defineEventHandler((event) => {
  const { dataProvider } = useRuntimeConfig(event);

  return {
    ok: true,
    dataProvider,
    packages: [DOMAIN_PACKAGE_NAME, OPEN_DATA_PACKAGE_NAME],
  };
});
