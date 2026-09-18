/**
 * Remembers in-flight and recent results by key, so two operations that need the same upstream
 * answer at the same time (`searchHouses` and `getNeighbourhoodFacts` for one Search Area) share
 * one request instead of doubling the load on the service. A rejected computation is forgotten at
 * once, so a retry hits the service again. Entries expire after `ttlMs`; the oldest is evicted
 * beyond `maxEntries`.
 */
export interface TtlMemo<T> {
  get(key: string, compute: () => Promise<T>): Promise<T>;
}

export interface TtlMemoOptions {
  ttlMs: number;
  maxEntries: number;
  /** Clock in milliseconds; injectable so tests can move time. */
  now: () => number;
}

export function createTtlMemo<T>(options: TtlMemoOptions): TtlMemo<T> {
  const entries = new Map<string, { value: Promise<T>; expiresAt: number }>();

  return {
    get(key, compute) {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > options.now()) return hit.value;

      const value = compute().catch((error: unknown) => {
        if (entries.get(key)?.value === value) entries.delete(key);
        throw error;
      });
      entries.delete(key);
      entries.set(key, { value, expiresAt: options.now() + options.ttlMs });
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      return value;
    },
  };
}
