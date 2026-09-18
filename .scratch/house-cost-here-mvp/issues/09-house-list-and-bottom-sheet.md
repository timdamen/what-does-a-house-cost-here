# 09 House list and bottom sheet

Status: done
Type: task
Blocked by: 08

## Goal

Spec section "House List"; user stories 13, 14, 23 to 30, 44, 45.

## Scope

- `app/components/HouseList.vue`: rows with address, building type, Price Signal or "no price data", distance from Location. Header line "N houses found, M with a price" plus "showing the first N" when `truncated`. Sort toggle distance/price (Nuxt UI button group). Virtualised with `@tanstack/vue-virtual` above 50 rows. Tapping a row selects (writes `h` in the URL), centres the map, and opens the sheet. Selecting from the map scrolls the list to the row. Rows are buttons with accessible names.
- `app/components/HouseSheet.vue`: Nuxt UI drawer (`UDrawer`) with snap points from the research note (peek, half, full), side panel on wide screens. Shows the compact card for the selected House: address, type, price (with kind, date, scope), distance, OSM link. Closing clears `h`.
- Fill `<section id="houses">` in `index.vue`.
- Component tests with `mountSuspended`: counts line, sort order, "no price data" row, selection emits.

## Acceptance

- Manual phone-viewport check of list, sheet snap points, and two-way sync.
- `pnpm quality` green.

## Updates after research (ticket 01)

The bottom sheet itself is built in ticket 08 (`BottomSheet.vue`, custom SSR component, not `UDrawer`). This ticket fills it: `HouseCard.vue` for the selected House (rendered in the sheet's card slot, sheet snaps to at least half when a selection is made from the map, closing clears `h`) and `HouseList.vue` in `#houses`. Do not build a second sheet. The list header row must fit in the peek state (one 48 px summary row: "N houses, M with a price"). Nuxt UI 4 renamed `UButtonGroup` to `UFieldGroup`.

## Comments

- Done. `pnpm quality` green (fmt, lint, `nuxt typecheck`, knip, 60 web unit tests across twelve files). One new dependency: `@tanstack/vue-virtual` `^3.13.39` (verified with `npm view`, recorded in `../versions.md`). Only the `<section id="houses">` block, the sheet's `card` slot and the script lines around the former `housesSummary` computed changed in `index.vue` (ticket 10 owns `#neighbourhood`).
- `HouseList.vue` (`app/components/`): props `houses: MapHouse[]`, `centre: Location`, `selectedHouseId?`, `truncated?`, `cap?`, `countryCode?`, `pricesStatus?` (`useFetch` status), `scrollElement?: HTMLElement | null` (defaults to the nearest ancestor with `overflow-y: auto|scroll`, i.e. the sheet body); emits `select(houseId)`. Header is one 48 px row: `<h2 id="houses-heading" class="sr-only">Houses</h2>`, the counts `<p aria-live="polite" data-testid="house-count">` ("122 houses, 64 with a price", "+ , showing the first N" when truncated; the "with a price" part appears once `pricesStatus === 'success'`), and a `UFieldGroup` sort toggle (`data-testid="house-sort"`, buttons `sort-distance` / `sort-price` with `aria-pressed`, 44 px tall). Rows are `<button data-testid="house-row" data-house-id>` inside `<ul>`/`<li aria-setsize aria-posinset>`: address (`houseAddressLabel`: street + number, "Unnamed building" fallback), building type label, distance via `useLocaleFormat`, abbreviated Price Signal with its kind, a skeleton while prices are pending, else "No price data". The selected row gets `aria-current="true"` and a primary ring; a change of `selectedHouseId` scrolls it into view (`scrollIntoView({ block: 'nearest' })`, or `scrollToIndex` when virtualised). Above 50 rows the list is virtualised with `useVirtualizer` (`data-virtualised="true"` on the `<ul>`, `scrollMargin` measured from the rows' offset inside the scroll element, dynamic row measurement). Empty Search Area: `data-testid="house-list-empty"`.
- `HouseCard.vue`: props `house: MapHouse`, `centre: Location`, `countryCode?`, `pricesStatus?`; emits `close`. `<article data-testid="house-card" aria-labelledby="house-card-title">` with the address as `h2#house-card-title`, "Terraced house · 150 m away", full price (`useLocaleFormat().price`) plus "Sale, aug 2023, this house" (kind, month/year in the locale, scope) in `data-testid="house-card-price"` (or "No price data" / skeleton), `data-testid="house-card-osm"` link to `https://www.openstreetmap.org/<way|node>/<id>` (`osmUrl` returns `null` for non-OSM ids and the link is hidden), and a 44 px close button `data-testid="house-card-close"`. Measured 96 px tall at 390 px wide.
- Pure helpers in `app/utils/houses.ts`: `listHouses(houses, centre, sort)` (distance, or price ascending with unpriced last and ties by distance), `houseCountSummary`, `countPriced`, `houseAddressLabel`, `buildingTypeLabel`, `priceKindLabel`, `priceScopeLabel`, `formatSignalDate`, `osmUrl`, `NO_PRICE_DATA`. Tested in `test/unit/house-list.test.ts` (with the component) and `house-card.test.ts`.
- `index.vue`: `HouseList` renders in `#houses` once `housesStatus === 'success'` (the heading row and `houses-skeleton` stay while pending), its `select` goes through the existing `onSelect` (writes `h`, lifts the sheet peek -> half; the map centres because `selectedHouseId` is its prop). `selectedHouse` (computed from `h` and `mapHouses`) renders `HouseCard` in the sheet's `card` slot; close calls `select(null)`. `housesSummary` moved into `HouseList` as `houseCountSummary`; `index-page.test.ts` now expects "with a price". Back collapsing the full sheet (ticket 08's open point) is still undecided; left for ticket 12.
- Manual check (Playwright, headless Chromium, 390x844 at 2x, dev server on 3093 with `NUXT_PUBLIC_TEST_HOOKS=true`, fixture provider): peek showed the sheet at 126.6 px with the 48 px header row "122 houses, 64 with a price" and the Distance/Price toggle, the list virtualised (7 of 122 rows in the DOM). `__houseMap.select('way/900000119')` wrote `h=` to the URL, snapped the sheet to half (422 px), showed the 96 px card ("Amstel 144", "Terraced house · 150 m away", "€ 764.000", "Sale, aug 2023, this house", "View on OpenStreetMap") and scrolled the ringed row (`aria-current`) into the body; the map showed the orange selected pill. Price sort listed € 649k, € 651k, € 665k ... with unpriced rows last. Tapping a row set `h=way/900000088`, the map's `selectedHouseId` followed and the card switched to "Kerkstraat 313". Close cleared `h` and removed the card. No console errors. Screenshot `list-phone.png` in the session scratchpad.

