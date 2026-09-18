/**
 * `@house-cost/domain/testing`: the Data Provider contract test. Imports Vitest, so it is kept
 * out of the main entry and only used from test files.
 */
export {
  runDataProviderContract,
  type DataProviderContractFactory,
  type DataProviderContractSubject,
} from '../test/contract/data-provider.contract';
