# 10 Neighbourhood Facts

Status: ready-for-agent
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
