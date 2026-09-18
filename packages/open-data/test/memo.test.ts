import { describe, expect, it } from 'vitest';

import { createTtlMemo } from '../src/memo';

function memoAt(clock: { now: number }, ttlMs = 1000, maxEntries = 2) {
  return createTtlMemo<string>({ ttlMs, maxEntries, now: () => clock.now });
}

describe('createTtlMemo', () => {
  it('shares one computation between concurrent and recent callers of the same key', async () => {
    const clock = { now: 0 };
    const memo = memoAt(clock);
    let runs = 0;
    const compute = async () => {
      runs += 1;
      return `run ${runs}`;
    };

    const [first, second] = await Promise.all([memo.get('a', compute), memo.get('a', compute)]);
    clock.now = 999;
    const third = await memo.get('a', compute);

    expect([first, second, third]).toEqual(['run 1', 'run 1', 'run 1']);
    expect(runs).toBe(1);
  });

  it('recomputes after the entry expires', async () => {
    const clock = { now: 0 };
    const memo = memoAt(clock);
    let runs = 0;
    const compute = async () => `run ${(runs += 1)}`;

    await memo.get('a', compute);
    clock.now = 1000;

    expect(await memo.get('a', compute)).toBe('run 2');
  });

  it('forgets a rejected computation so the next call tries again', async () => {
    const memo = memoAt({ now: 0 });
    let runs = 0;
    const compute = async () => {
      runs += 1;
      if (runs === 1) throw new Error('down');
      return 'up';
    };

    await expect(memo.get('a', compute)).rejects.toThrow('down');
    await expect(memo.get('a', compute)).resolves.toBe('up');
    expect(runs).toBe(2);
  });

  it('evicts the oldest entries beyond maxEntries', async () => {
    const memo = memoAt({ now: 0 }, 1000, 2);
    let runs = 0;
    const compute = async () => `run ${(runs += 1)}`;

    await memo.get('a', compute);
    await memo.get('b', compute);
    await memo.get('c', compute);

    expect(await memo.get('a', compute)).toBe('run 4');
    expect(await memo.get('c', compute)).toBe('run 3');
  });
});
