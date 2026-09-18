import {
  UpstreamError,
  type HouseRef,
  type PriceSignal,
  type PriceSummary,
} from '@house-cost/domain';

import type { HttpClient } from '../http-client';
import { isRecord } from '../json';
import { normalisePostcode } from '../overpass/houses';
import type { PriceAdapter } from './registry';

/**
 * HM Land Registry Price Paid Data, Linked Data API (Elda). Plain GET with query-string filters
 * and JSON output; the SPARQL endpoint is not used.
 */
export const LAND_REGISTRY_URL =
  'https://landregistry.data.gov.uk/data/ppi/transaction-record.json';

/** `provenance.source` and `PriceSignal.source` for Price Paid Data. */
export const LAND_REGISTRY_SOURCE = 'hm-land-registry-ppd';

/** `UpstreamError.service` for Land Registry failures. */
export const LAND_REGISTRY_SERVICE = 'land-registry';

/** Country codes the register covers. PPD covers England and Wales; both are `GB`. */
const LAND_REGISTRY_COUNTRY_CODES = ['GB'] as const;

/** The price summary looks back this many months from `now`. */
export const SUMMARY_WINDOW_MONTHS = 24;

/** Most transactions fetched per postcode (newest first). */
const LAND_REGISTRY_PAGE_SIZE = 100;

/**
 * Upper bound on register requests per operation. The postcodes with the most Houses in the
 * area are queried first. Keeps a 300-House area to a bounded number of upstream calls.
 */
const MAX_POSTCODES_PER_CALL = 30;

/** Exact-address (`scope: 'house'`) signals kept per House, newest first. */
export const MAX_HOUSE_SIGNALS = 5;

/** A PPD transaction reduced to what the adapter needs. */
export interface LandRegistryTransaction {
  pricePaid: number;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  postcode: string;
  /** Primary addressable object name: the house number or name. */
  paon?: string;
  /** `true` for category A (standard price paid) transactions. */
  standard: boolean;
}

export interface LandRegistryAdapterOptions {
  client: HttpClient;
  url?: string;
  now?: () => Date;
}

/**
 * Price Signals and summaries from HM Land Registry Price Paid Data, matched by postcode.
 *
 * - Signals: for every House with a postcode, transactions whose PAON equals the House's number
 *   or name are `scope: 'house'`; otherwise the newest sale in the postcode is one
 *   `scope: 'street'` signal (a UK postcode is roughly one street segment).
 * - Summary: standard (category A) sales in the area's postcodes over the last
 *   `SUMMARY_WINDOW_MONTHS`. `typical` is the median, `low`/`high` are the 10th and 90th
 *   percentiles (nearest rank, so min/max for small samples), `asOf` the newest sale date.
 */
export function createLandRegistryAdapter(options: LandRegistryAdapterOptions): PriceAdapter {
  const { client } = options;
  const url = options.url ?? LAND_REGISTRY_URL;
  const now = options.now ?? (() => new Date());

  async function transactionsFor(postcode: string): Promise<LandRegistryTransaction[]> {
    const params = new URLSearchParams({
      'propertyAddress.postcode': postcode,
      _pageSize: String(LAND_REGISTRY_PAGE_SIZE),
      _sort: '-transactionDate',
    });
    const body = await client.json(`${url}?${params}`, { service: LAND_REGISTRY_SERVICE });
    return parseTransactions(body);
  }

  async function transactionsByPostcode(
    houses: readonly HouseRef[],
  ): Promise<Map<string, LandRegistryTransaction[]>> {
    const postcodes = rankedPostcodes(houses).slice(0, MAX_POSTCODES_PER_CALL);
    const pages = await Promise.all(
      postcodes.map(async (postcode) => [postcode, await transactionsFor(postcode)] as const),
    );
    return new Map(pages);
  }

  return {
    countryCodes: LAND_REGISTRY_COUNTRY_CODES,
    source: LAND_REGISTRY_SOURCE,

    async getPriceSignals(houses) {
      if (houses.length === 0) return [];
      const byPostcode = await transactionsByPostcode(houses);
      const signals: PriceSignal[] = [];
      for (const house of houses) {
        const postcode = housePostcode(house);
        const transactions = postcode === undefined ? undefined : byPostcode.get(postcode);
        if (!transactions || transactions.length === 0) continue;
        signals.push(...signalsForHouse(house, transactions));
      }
      return signals;
    },

    async getPriceSummary(houses) {
      if (houses.length === 0) return null;
      const byPostcode = await transactionsByPostcode(houses);
      const since = monthsBefore(now(), SUMMARY_WINDOW_MONTHS);
      const sales = [...byPostcode.values()]
        .flat()
        .filter((transaction) => transaction.standard && transaction.date >= since);
      return summarise(sales);
    },
  };
}

/** Distinct normalised postcodes of the Houses, the ones with the most Houses first. */
export function rankedPostcodes(houses: readonly HouseRef[]): string[] {
  const counts = new Map<string, number>();
  for (const house of houses) {
    const postcode = housePostcode(house);
    if (postcode !== undefined) counts.set(postcode, (counts.get(postcode) ?? 0) + 1);
  }
  return [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([postcode]) => postcode);
}

function housePostcode(house: HouseRef): string | undefined {
  const postcode = house.address?.postcode;
  return postcode ? normalisePostcode(postcode) : undefined;
}

function signalsForHouse(
  house: HouseRef,
  transactions: readonly LandRegistryTransaction[],
): PriceSignal[] {
  const number = house.address?.housenumber?.trim().toUpperCase();
  const exact =
    number === undefined
      ? []
      : transactions.filter((transaction) => transaction.paon?.toUpperCase() === number);

  if (exact.length > 0) {
    return exact
      .slice(0, MAX_HOUSE_SIGNALS)
      .map((transaction) => toSignal(house, transaction, 'house'));
  }
  const newest = transactions[0];
  return newest === undefined ? [] : [toSignal(house, newest, 'street')];
}

function toSignal(
  house: HouseRef,
  transaction: LandRegistryTransaction,
  scope: PriceSignal['scope'],
): PriceSignal {
  return {
    houseId: house.id,
    amount: transaction.pricePaid,
    currency: 'GBP',
    kind: 'sale',
    date: transaction.date,
    scope,
    source: LAND_REGISTRY_SOURCE,
  };
}

/** Median, 10th and 90th percentiles (nearest rank) of the sales, or `null` for no sales. */
export function summarise(sales: readonly LandRegistryTransaction[]): PriceSummary | null {
  if (sales.length === 0) return null;
  const prices = sales.map((sale) => sale.pricePaid).toSorted((a, b) => a - b);
  const asOf = sales.reduce((newest, sale) => (sale.date > newest ? sale.date : newest), '');
  return {
    typical: median(prices),
    low: percentile(prices, 0.1),
    high: percentile(prices, 0.9),
    currency: 'GBP',
    asOf,
    sampleSize: sales.length,
    windowMonths: SUMMARY_WINDOW_MONTHS,
  };
}

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1] ?? upper;
  return Math.round((lower + upper) / 2);
}

/** Nearest-rank percentile: the value at rank `ceil(p * n)`. */
function percentile(sorted: readonly number[], p: number): number {
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[rank - 1] ?? 0;
}

/** ISO date `months` before `date`, clamped to the end of the resulting month. */
export function monthsBefore(date: Date, months: number): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() - months;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toIsoDate(new Date(Date.UTC(year, month, Math.min(day, lastDay))));
}

/** Narrows a `transaction-record.json` body to its transactions, skipping malformed items. */
function parseTransactions(body: unknown): LandRegistryTransaction[] {
  const result = isRecord(body) && isRecord(body.result) ? body.result : undefined;
  if (!result || !Array.isArray(result.items)) {
    throw new UpstreamError(LAND_REGISTRY_SERVICE, 'land-registry: unexpected response shape', {
      retryable: false,
    });
  }
  const transactions: LandRegistryTransaction[] = [];
  for (const item of result.items) {
    const transaction = parseTransaction(item);
    if (transaction) transactions.push(transaction);
  }
  return transactions.toSorted((a, b) => b.date.localeCompare(a.date));
}

function parseTransaction(item: unknown): LandRegistryTransaction | undefined {
  if (!isRecord(item)) return undefined;
  if (!isRecord(item.propertyAddress)) return undefined;
  const address = item.propertyAddress;
  const date = parsePpdDate(item.transactionDate);
  const postcode = typeof address.postcode === 'string' ? address.postcode : undefined;
  if (typeof item.pricePaid !== 'number' || !date || !postcode) return undefined;

  const category = isRecord(item.transactionCategory)
    ? item.transactionCategory['_about']
    : undefined;
  const transaction: LandRegistryTransaction = {
    pricePaid: item.pricePaid,
    date,
    postcode: normalisePostcode(postcode),
    standard: typeof category !== 'string' || category.endsWith('standardPricePaidTransaction'),
  };
  if (typeof address.paon === 'string') transaction.paon = address.paon;
  return transaction;
}

const MONTHS: Readonly<Record<string, number>> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

/** The JSON API renders dates as `Mon, 30 Jun 2025`; ISO input is accepted too. */
export function parsePpdDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return iso[0];
  const rfc = /(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})/.exec(value);
  if (!rfc) return undefined;
  const month = MONTHS[rfc[2] ?? ''];
  if (month === undefined) return undefined;
  return toIsoDate(new Date(Date.UTC(Number(rfc[3]), month, Number(rfc[1]))));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
