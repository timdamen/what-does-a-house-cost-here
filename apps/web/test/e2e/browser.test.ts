import {
  AMSTERDAM_CENTRE,
  SYDNEY_CENTRE,
  haversineMetres,
  type HouseSearchResult,
} from '@house-cost/domain';
import { $fetch, createPage, setup, url } from '@nuxt/test-utils/e2e';
import { expect as baseExpect } from '@playwright/test';
import type { BrowserContextOptions, Locator, Page } from 'playwright-core';
import { afterEach, describe, it } from 'vitest';

/**
 * Browser tests at a phone viewport (spec "Testing Decisions", seam one). One production build
 * with the fixture provider and `public.testHooks` on, driven through headless Chromium with a
 * touch screen. Geolocation is faked through the browser context: granted via `permissions` +
 * `geolocation`, denied and absent via init scripts. Tests only wait for the map where the map
 * is part of the behaviour under test; everything else is asserted on the server-rendered shell
 * and the data that hydrates into it.
 */

/** Playwright's `expect` outside its runner: auto-retrying locator assertions and `expect.poll`. */
const expect = baseExpect.configure({ timeout: 15_000 });

/** MapLibre has to fetch the style and tiles from the open host, so the map gets longer. */
const MAP_READY_TIMEOUT_MS = 45_000;

const PHONE: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
};

/** The fixture town: houses, prices and facts around `AMSTERDAM_CENTRE`. */
const TOWN = { latitude: AMSTERDAM_CENTRE.lat, longitude: AMSTERDAM_CENTRE.lng, accuracy: 10 };
const TOWN_LINK = `/?lat=${AMSTERDAM_CENTRE.lat}&lng=${AMSTERDAM_CENTRE.lng}&r=500`;
/** The fixture area whose region has no open price register. */
const SYDNEY_LINK = `/?lat=${SYDNEY_CENTRE.lat}&lng=${SYDNEY_CENTRE.lng}`;

const FACTS_HEADINGS = [
  'Where you are',
  'What houses cost',
  'Daily life',
  "What's here",
  'About this data',
];

/** Sheet heights from `SHEET_SNAP_CSS` (`app/utils/sheet.ts`): `max(96px, 15dvh)`, `50dvh`, `90dvh` of 844 px. */
const SHEET_HEIGHT_PX = { peek: 126.6, half: 422, full: 759.6 };

interface HookState {
  status: 'loading' | 'ready' | 'error';
  radiusMetres: number;
  houseCount: number;
  selectedHouseId: string | null;
}

/** `window.__houseMap` as `HouseMap.client.vue` installs it when `testHooks` is on. */
type HookWindow = Window & {
  __houseMap?: { select(houseId: string | null): void; getState(): HookState };
  geolocationRequested?: boolean;
};

const openPages: Page[] = [];

async function openPage(path?: string, options: BrowserContextOptions = {}): Promise<Page> {
  const page = await createPage(path, { ...PHONE, ...options });
  openPages.push(page);
  return page;
}

function query(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

function mapState(page: Page): Promise<HookState | null> {
  return page.evaluate(() => (window as HookWindow).__houseMap?.getState() ?? null);
}

async function waitForMap(page: Page): Promise<void> {
  await expect
    .poll(async () => (await mapState(page))?.status, { timeout: MAP_READY_TIMEOUT_MS })
    .toBe('ready');
}

function sheetOf(page: Page) {
  const sheet = page.getByTestId('bottom-sheet');
  return {
    sheet,
    handle: page.getByTestId('sheet-handle'),
    // The scrollable body has no test id of its own; it is the sheet's overflow container.
    body: sheet.locator('.bottom-sheet__body'),
  };
}

/** Waits out the 250 ms height transition and checks the sheet landed on a snap height. */
async function expectSheetHeight(sheet: Locator, px: number): Promise<void> {
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return box ? Math.abs(box.height - px) : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(2);
}

/**
 * Where the row sits relative to the sheet's scrollable body: `inside` once it is scrolled into
 * view, otherwise the two boxes so a failure says how far off it was.
 */
async function rowPlacement(row: Locator, body: Locator): Promise<string> {
  const [rowBox, bodyBox] = await Promise.all([row.boundingBox(), body.boundingBox()]);
  if (!rowBox || !bodyBox)
    return `row ${rowBox ? 'visible' : 'missing'}, body ${bodyBox ? 'visible' : 'missing'}`;
  const rowBottom = rowBox.y + rowBox.height;
  const bodyBottom = bodyBox.y + bodyBox.height;
  if (rowBox.y >= bodyBox.y - 1 && rowBottom <= bodyBottom + 1) return 'inside';
  return `row ${Math.round(rowBox.y)}..${Math.round(rowBottom)} outside body ${Math.round(bodyBox.y)}..${Math.round(bodyBottom)}`;
}

/**
 * A one-finger drag through CDP so the sheet sees real touch pointer events (`pointerType:
 * 'touch'`), which is what a phone sends. Playwright's `Touchscreen` only knows how to tap.
 */
async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 10,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let step = 1; step <= steps; step += 1) {
      // Touch moves are a sequence; sending them in parallel would reorder the finger.
      // oxlint-disable-next-line no-await-in-loop
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: from.x + ((to.x - from.x) * step) / steps,
            y: from.y + ((to.y - from.y) * step) / steps,
          },
        ],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

async function dragHandleBy(page: Page, handle: Locator, deltaY: number): Promise<void> {
  const box = await handle.boundingBox();
  if (!box) throw new Error('The sheet handle has no bounding box');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await touchDrag(page, start, { x: start.x, y: start.y + deltaY });
}

/** House ids in the order the list shows them (distance from the centre). */
async function houseIdsByDistance(): Promise<string[]> {
  const { data } = await $fetch<HouseSearchResult>(
    `/api/houses?lat=${AMSTERDAM_CENTRE.lat}&lng=${AMSTERDAM_CENTRE.lng}&radius=500`,
  );
  return data
    .toSorted(
      (a, b) =>
        haversineMetres(AMSTERDAM_CENTRE, a.location) -
        haversineMetres(AMSTERDAM_CENTRE, b.location),
    )
    .map((house) => house.id);
}

describe('the one-pager in a phone browser', async () => {
  await setup({
    server: true,
    browser: true,
    browserOptions: { type: 'chromium', launch: { headless: true } },
    nuxtConfig: {
      runtimeConfig: { dataProvider: 'fixture', public: { testHooks: true } },
    },
  });

  afterEach(async () => {
    await Promise.all(openPages.splice(0).map((page) => page.context().close()));
  });

  describe('arriving without a location', () => {
    it('centres on the device position when geolocation is granted', async () => {
      const page = await openPage('/', { geolocation: TOWN, permissions: ['geolocation'] });

      await expect.poll(() => query(page).get('lat')).toBe('52.3676');
      expect(query(page).get('lng')).toBe('4.9041');
      expect(query(page).get('r')).toBeNull();
      await expect(page.getByRole('heading', { name: 'Where are you?' })).toHaveCount(0);
      await expect(page.getByTestId('house-count')).toContainText(/^\d+ houses/);
    });

    it('offers place search when geolocation is denied, and a search sets the URL', async () => {
      const page = await openPage();
      await page.context().clearPermissions();
      // Chromium already rejects without a grant; the init script makes the denial explicit
      // and immediate instead of relying on the browser's permission model.
      await page.context().addInitScript(() => {
        navigator.geolocation.getCurrentPosition = (_success, failure) => {
          setTimeout(
            () =>
              failure?.({
                code: 1,
                message: 'User denied geolocation',
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              }),
            0,
          );
        };
      });
      await page.goto(url('/'), { waitUntil: 'hydration' });

      await expect(page.getByText('Location access was turned off')).toBeVisible();
      const search = page.getByRole('combobox', { name: 'Search for a place' });
      await expect(search).toBeVisible();
      await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();

      await search.fill('Sydney');
      await page.getByTestId('place-search-submit').tap();
      await page.getByRole('option', { name: 'Sydney, New South Wales, Australia' }).tap();

      await expect.poll(() => query(page).get('lat')).toBe(String(SYDNEY_CENTRE.lat));
      expect(query(page).get('lng')).toBe(String(SYDNEY_CENTRE.lng));
      await expect(page.getByTestId('one-pager')).toBeVisible();
      await expect(page.getByTestId('house-count')).toContainText(/^\d+ houses/);
    });

    it('offers place search when the browser has no geolocation API', async () => {
      const page = await openPage();
      await page.context().addInitScript(() => {
        delete (Navigator.prototype as { geolocation?: Geolocation }).geolocation;
      });
      await page.goto(url('/'), { waitUntil: 'hydration' });

      await expect(page.getByText('This browser cannot share your location')).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Search for a place' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Use my location' })).toHaveCount(0);
      expect(query(page).get('lat')).toBeNull();
    });
  });

  describe('arriving through a shared link', () => {
    it('skips the location prompt and shows the houses for the linked area', async () => {
      const page = await openPage();
      await page.context().addInitScript(() => {
        const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition = (...args) => {
          (window as HookWindow).geolocationRequested = true;
          return original(...args);
        };
      });
      await page.goto(url(TOWN_LINK), { waitUntil: 'hydration' });

      await expect(page.getByRole('heading', { name: 'Where are you?' })).toHaveCount(0);
      await expect(page.getByTestId('one-pager')).toBeVisible();
      await expect(page.getByTestId('house-map-frame')).toBeVisible();
      await expect(sheetOf(page).sheet).toHaveAttribute('data-snap', 'peek');
      await expect(page.getByTestId('house-count')).toContainText(/^\d+ houses/);
      expect(query(page).get('lat')).toBe('52.3676');
      expect(query(page).get('r')).toBe('500');
      expect(await page.evaluate(() => (window as HookWindow).geolocationRequested ?? false)).toBe(
        false,
      );
    });

    it('shows the no-price-data card for a region without an open price register', async () => {
      const page = await openPage(SYDNEY_LINK);
      const { handle, sheet } = sheetOf(page);
      await handle.press('Home');
      await expect(sheet).toHaveAttribute('data-snap', 'full');

      const card = page.getByTestId('no-price-data');
      await expect(card).toBeVisible();
      await expect(card).toContainText('No open price data for this region yet');
      await expect(card).toContainText('Australia');
      await expect(page.getByTestId('price-summary')).toHaveCount(0);
      await expect(page.getByTestId('house-row').first()).toContainText('No price data');
    });
  });

  describe('selecting a house', () => {
    it('tapping a list row writes h to the URL and shows the card', async () => {
      const page = await openPage(TOWN_LINK);
      const { sheet } = sheetOf(page);
      const row = page.getByTestId('house-row').first();
      await expect(row).toBeVisible();
      const houseId = await row.getAttribute('data-house-id');
      expect(houseId).toMatch(/^(way|node)\/\d+$/);
      // The row reads "<address>\n<type> · <distance>\n<price>"; the card titles itself with the address.
      const address = (await row.innerText()).split('\n')[0]?.trim() ?? '';
      expect(address).not.toBe('');

      await row.tap();

      await expect.poll(() => query(page).get('h')).toBe(houseId);
      await expect(sheet).toHaveAttribute('data-snap', 'half');
      const card = page.getByTestId('house-card');
      await expect(card).toBeVisible();
      await expect(card.getByRole('heading', { level: 2 })).toHaveText(address);
      await expect(row).toHaveAttribute('aria-current', 'true');

      await page.getByTestId('house-card-close').tap();
      await expect.poll(() => query(page).get('h')).toBeNull();
      await expect(card).toHaveCount(0);
      await expect(row).not.toHaveAttribute('aria-current', 'true');
    });

    it('selecting a marker on the map scrolls its row into view and marks it current', async () => {
      // Marker taps are driven through `window.__houseMap.select(id)` rather than canvas taps:
      // the houses live in a WebGL canvas, most of them start inside clusters at the initial
      // zoom, and their screen positions depend on tile and glyph loading, so hit-testing a
      // pixel is not reliable. The hook emits exactly what a marker tap emits.
      const page = await openPage(TOWN_LINK);
      await waitForMap(page);
      const { sheet, body } = sheetOf(page);

      const ids = await houseIdsByDistance();
      expect(ids.length).toBeGreaterThan(50);
      // Deep enough in the (virtualised) list that it starts outside the DOM.
      const target = ids[Math.floor(ids.length * 0.6)];
      if (!target) throw new Error('No house to select');

      await page.evaluate((id) => (window as HookWindow).__houseMap?.select(id), target);

      await expect.poll(() => query(page).get('h')).toBe(target);
      await expect(sheet).toHaveAttribute('data-snap', 'half');
      const row = page.locator(`[data-testid="house-row"][data-house-id="${target}"]`);
      await expect(row).toHaveAttribute('aria-current', 'true');
      await expect.poll(() => rowPlacement(row, body)).toBe('inside');
      await expect(page.getByTestId('house-card')).toBeVisible();
      await expect.poll(async () => (await mapState(page))?.selectedHouseId).toBe(target);
    });
  });

  describe('changing the search radius', () => {
    it('updates r in the URL and the count line', async () => {
      const page = await openPage(TOWN_LINK);
      await waitForMap(page);
      const count = page.getByTestId('house-count');
      await expect(count).toContainText(/^\d+ houses/);
      const before = await count.innerText();
      const beforeCount = Number.parseInt(before, 10);
      expect(beforeCount).toBeGreaterThan(0);

      // The fixture town has all of its houses within 500 m, so only shrinking the radius
      // changes the count (122 at 500 m, 40 at 250 m).
      const smaller = page.getByTestId('radius-control').getByRole('button', { name: '250 m' });
      await expect(smaller).toHaveAttribute('aria-pressed', 'false');
      await smaller.tap();

      await expect.poll(() => query(page).get('r')).toBe('250');
      await expect(smaller).toHaveAttribute('aria-pressed', 'true');
      await expect(count).not.toHaveText(before);
      await expect(count).toContainText(/^\d+ houses/);
      expect(Number.parseInt(await count.innerText(), 10)).toBeLessThan(beforeCount);
      await expect.poll(async () => (await mapState(page))?.radiusMetres).toBe(250);
    });
  });

  describe('the bottom sheet', () => {
    it('moves between peek, half and full from the keyboard on the handle', async () => {
      const page = await openPage(TOWN_LINK);
      const { sheet, handle } = sheetOf(page);
      await expect(sheet).toHaveAttribute('data-snap', 'peek');
      await expectSheetHeight(sheet, SHEET_HEIGHT_PX.peek);
      await handle.focus();

      await handle.press('ArrowUp');
      await expect(sheet).toHaveAttribute('data-snap', 'half');
      await expect(handle).toHaveAttribute('aria-label', 'Resize sheet (now half)');
      await expectSheetHeight(sheet, SHEET_HEIGHT_PX.half);

      await handle.press('ArrowUp');
      await expect(sheet).toHaveAttribute('data-snap', 'full');
      await expectSheetHeight(sheet, SHEET_HEIGHT_PX.full);

      await handle.press('ArrowUp');
      await expect(sheet).toHaveAttribute('data-snap', 'full');

      await handle.press('ArrowDown');
      await expect(sheet).toHaveAttribute('data-snap', 'half');

      await handle.press('End');
      await expect(sheet).toHaveAttribute('data-snap', 'peek');
      await expectSheetHeight(sheet, SHEET_HEIGHT_PX.peek);

      await handle.press('Home');
      await expect(sheet).toHaveAttribute('data-snap', 'full');

      await handle.press('Escape');
      await expect(sheet).toHaveAttribute('data-snap', 'half');
    });

    it('collapses from full to half on the browser Back button without leaving the page', async () => {
      const page = await openPage(TOWN_LINK);
      const { sheet, handle } = sheetOf(page);
      await handle.press('Home');
      await expect(sheet).toHaveAttribute('data-snap', 'full');

      await page.goBack();

      await expect(sheet).toHaveAttribute('data-snap', 'half');
      await expect(page.getByTestId('one-pager')).toBeVisible();
      expect(query(page).get('lat')).toBe('52.3676');
      expect(query(page).get('r')).toBe('500');
    });

    it('snaps to the nearest point after a touch drag on the handle', async () => {
      const page = await openPage(TOWN_LINK);
      const { sheet, handle } = sheetOf(page);
      await expect(sheet).toHaveAttribute('data-snap', 'peek');
      await expectSheetHeight(sheet, SHEET_HEIGHT_PX.peek);

      // peek (127 px) dragged up 300 px lands at 427 px: nearest is half (422 px).
      await dragHandleBy(page, handle, -300);
      await expect(sheet).toHaveAttribute('data-snap', 'half');
      await expectSheetHeight(sheet, SHEET_HEIGHT_PX.half);

      // half dragged up 300 px lands at 722 px: nearest is full (760 px).
      await dragHandleBy(page, handle, -300);
      await expect(sheet).toHaveAttribute('data-snap', 'full');
      await expectSheetHeight(sheet, SHEET_HEIGHT_PX.full);

      // full dragged down 550 px lands at 210 px: nearest is peek.
      await dragHandleBy(page, handle, 550);
      await expect(sheet).toHaveAttribute('data-snap', 'peek');
      await expectSheetHeight(sheet, SHEET_HEIGHT_PX.peek);

      // A tap on the handle still cycles peek -> half.
      await handle.tap();
      await expect(sheet).toHaveAttribute('data-snap', 'half');
    });
  });

  describe('the neighbourhood facts', () => {
    it('shows the five headings in order', async () => {
      const page = await openPage(TOWN_LINK);
      const { handle, sheet } = sheetOf(page);
      await handle.press('Home');
      await expect(sheet).toHaveAttribute('data-snap', 'full');

      const facts = page.getByTestId('neighbourhood-facts');
      await expect(facts.getByRole('heading', { level: 3 })).toHaveText(FACTS_HEADINGS);
      await expect(page.getByTestId('facts-name')).not.toBeEmpty();
      await expect(page.getByTestId('price-summary')).toBeVisible();
      expect(await page.getByTestId('amenity').count()).toBeGreaterThan(0);
      await expect(page.getByTestId('provenance')).toContainText('Neighbourhood facts');
    });
  });
});
