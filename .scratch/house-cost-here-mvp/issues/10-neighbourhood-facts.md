# 10 Neighbourhood Facts

Status: done
Type: task
Blocked by: 08

## Goal

Spec section "Neighbourhood Facts"; user stories 31 to 38, 44.

## Scope

- `app/components/NeighbourhoodFacts.vue` filling `<section id="neighbourhood">`, headings in this order: "Where you are" (name and hierarchy), "What homes cost" (price summary typical/low/high/as of/sample size, or the first-class "No open price data for this region yet" card styled deliberately, with one line on why), "Daily life" (amenities by class with walking minutes; each is a button that emits `focus-amenity(location)` which the page passes to the map), "What's here" (housing mix as a compact bar or list), "About this data" (sources and fetched-at times from provenance).
- Headings are real `h2`s; lists are lists; the section is navigable by screen reader and keyboard.
- Component tests: headings order, no-data card for the fixture no-data area, amenity click emits.

## Acceptance

- Manual check against both fixture areas.
- `pnpm quality` green.

## Updates after research (ticket 01)

The facts live inside the bottom sheet's `#neighbourhood` section below the house list (see ticket 08 updates). Amenity taps still emit `focus-amenity`, and the page should collapse the sheet to half so the map is visible when the amenity is focused.

## Comments

- Done. `pnpm quality` green (fmt, lint, `nuxt typecheck`, knip, unit tests; eight new web tests in `test/unit/neighbourhood-facts.test.ts`). No new dependencies. Manual check on port 3110 with the fixture provider.
- `NeighbourhoodFacts.vue` (`app/components/`): props `facts: NeighbourhoodFacts | null`, `provenance?: Provenance | null`, `housesProvenance?: Provenance | null`, `status?: AsyncDataRequestStatus` (default `idle`), `countryCode?: string`; emits `focus-amenity(location: Location)`. It owns the loading state: while `status` is `idle`/`pending` or `facts` is `null` it renders the four skeleton tiles (`data-testid="neighbourhood-skeleton"`, `aria-busy`), on `error` a one-line "The Neighbourhood Facts could not be loaded." (`neighbourhood-unavailable`; the page's `ErrorRetry` card carries the retry). The `#neighbourhood` section in `index.vue` keeps its `h2` "Neighbourhood" row (`aria-labelledby`), so the component's five headings are `h3`s, in this order: "Where you are", "What homes cost", "Daily life", "What's here", "About this data"; each is its own `<section aria-labelledby>` with `useId()`-prefixed ids.
- Markup: name (`facts-name`) and an `<ol aria-label="Place hierarchy">` (`facts-hierarchy`, suburb › city › region › country, blanks and consecutive duplicates dropped, chevrons drawn in CSS so they are not read out). Price Summary as a `UCard` (`price-summary`, `dl` with `price-typical` / `price-low` / `price-high`, "As of <date>." with a `<time datetime>` and "Based on N sales in the last 24 months."); `priceSummary === null` renders the dashed card `no-price-data` titled "No open price data for this region yet" with "This app only uses open price registers, and <country> has none wired up." Amenities: `<ul aria-label="Amenities by type">` (`amenities`) with one `li[data-amenity-class]` per class in the fixed order school, supermarket, healthcare, park, transport; each Amenity is a 48 px `<button data-testid="amenity" data-amenity-class>` reading "<name>, N min walk (<distance>), show on map"; an empty class shows "None within reach". Housing Mix: an `aria-hidden` stacked bar (`housing-mix-bar`, 2 px surface gaps, colour fixed per building type from the dataviz reference palette with dark-mode steps) plus a `<ul>` (`housing-mix`) of "<label>, <count> (<pct>%)" largest first and a "<N> Houses in the Search Area." footer. About this data: `<ul>` (`provenance`) with one row per fetched result ("Neighbourhood facts: <sources>, fetched <Intl.DateTimeFormat medium/short>" and "Houses: …"), and `attribution` (`<ul>` of links) with "© OpenStreetMap contributors" when a source names OpenStreetMap, Overpass or Nominatim and the HM Land Registry OGL line when one names `land-registry`. Fixture runs show "Offline sample data" and no attribution.
- Pure helpers in `app/utils/facts.ts` (`hierarchyTrail`, `housingMixEntries`, `sourceNames`, `attributionsFor`, `provenanceRows`, `formatIsoDate`, `formatTimestamp`, label maps). Formatting follows `useLocaleFormat(countryCode)`: `nl-NL` renders "€ 686.000", "30 juni 2026", "17 sep 2026, 22:00"; `en-AU` renders "17 Sept 2026, 10:00 pm". UI strings themselves stay English (spec: only numbers, currency, units and dates are localised).
- `index.vue`: the section's skeleton `div` is replaced by `<NeighbourhoodFacts>`; `result` is now destructured from `useHouses` and `useFacts` for the two provenances; `amenityFocus` ref is passed to `HouseMapFrame` (a fresh object per tap so a repeat tap reveals again; cleared when the Location changes); `focus-amenity` sets it and snaps the sheet to `half` (ADR-0006).
- Manual check (Playwright, headless Chromium, 390x844, 2x, sheet at full via two handle taps): Amsterdam showed "Grachtengordel-Zuid › Amsterdam › Noord-Holland › Nederland", typical € 686.000 (low € 414.000, high € 1.053.000, as of 30 juni 2026, 64 sales), five amenity groups with 11 buttons at 48 px, the mix bar (Apartments 47 %, Terraced 34 %, …) and both provenance rows; no horizontal overflow (scrollWidth 390). Sydney showed "Sydney › New South Wales › Australia" and the dashed no-data card naming Australia. Tapping Sarphatipark (1.1 km south) snapped the sheet to half, drew the orange focus circle and panned the map (visible centre 52.3585, 4.8992). No console errors beyond Chromium's WebGL ReadPixels warning.
- Findings for tickets 07/12: `HouseMap.revealLocation` decides "already visible" from the fixed `peekHeight`, not the sheet's current snap, so an Amenity that sits under the half-open sheet does not trigger a pan (the first school, 600 m away, stayed hidden behind the sheet), and when it does pan the marker lands about 35 px above the sheet edge. The programmatic pan also shows the "Search here" pill. Passing the sheet's live height to the map (or a `visibleHeight` prop) would fix both; left for a follow-up since it changes the map contract.
