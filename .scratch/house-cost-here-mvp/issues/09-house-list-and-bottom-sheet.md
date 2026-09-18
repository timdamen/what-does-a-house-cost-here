# 09 House list and bottom sheet

Status: ready-for-agent
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
