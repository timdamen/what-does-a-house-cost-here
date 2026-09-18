# 0006 The Bottom Sheet hosts the house list and Neighbourhood Facts, not only the House Card

Status: accepted (2026-09-17)

## Context

The spec's page structure puts the map above the fold, the house list "beneath the map" on a scrolling page, the Neighbourhood Facts below that, and a three-snap-point bottom sheet holding only the selected House card (user stories 14, 23, 37). The research pass was allowed to overturn this, and did (research note, overturned default 2).

The finding: a full-viewport map has no gutter to start a page scroll from. NN/g observed that users begin swipes on the lower half of the screen, which pans the map instead of scrolling the page. NN/g's own model of a non-modal sheet is Google Maps, where the sheet shows details while the map stays pannable. The spec's structure would have made the list hard to reach on exactly the device the app is built for.

Alternatives: a shorter map (60dvh) with the page scrolling beneath it (the spec's default; keeps the scroll gutter but shrinks the map that is the product's promise), or Nuxt UI's `UDrawer` (client-only, modal, content not server-rendered).

## Decision

- On phones the map is fixed at `100dvh`. A custom, server-rendered `BottomSheet.vue` sits over it with three snap points: peek `15dvh` (min 96px), half `50dvh`, full `90dvh`, in `dvh` units.
- The sheet hosts, top to bottom: the House Card when a House is selected, the house list in `<section id="houses">`, and the Neighbourhood Facts in `<section id="neighbourhood">`. Peek shows the one-row count summary ("42 houses, 18 with prices"), half shows the list, full shows list then facts. The DOM order is map, summary, list, facts for SSR and screen readers.
- Selecting a House from the map snaps the sheet to at least half and pushes the House Card in; closing the card clears `h` in the URL. Back or Escape collapses the sheet from full. The drag handle also cycles snap points on tap and is keyboard operable. Focusing an Amenity collapses the sheet to half so the map is visible.
- At `>= 840px` (Android "expanded" width class) the same component renders as a side panel one third of the window wide, with the map beside it.
- It is a custom component, not `UDrawer`, because its content must be server-rendered and always present. Nuxt UI is used for everything inside it.
- Snap transitions are `0ms` under `prefers-reduced-motion: reduce`.

## Consequences

- The spec's "beneath the map" now means "inside the sheet". Tickets 08, 09 and 10 were updated; ticket 09 builds no second sheet.
- The list header must fit the peek state: one 48 px summary row. The map's server-rendered placeholder and the sheet together must keep CLS at or under 0.1.
- Map controls stack above `calc(peek + 16px + env(safe-area-inset-bottom))`, and the compact attribution sits above the peek so it is never covered (research decision 3).
- NN/g found store-locator users preferred a list first; the half state keeps the list one drag away without giving up the map-first promise.
- A custom sheet is code the project owns: drag physics, snap logic, focus management and Back handling are ours to test (ticket 12 covers snap points at a phone viewport).
- Sheet state is ephemeral and not in the URL (ADR-0003).

## References

- `docs/research/mobile-map-ux.md`: decision 2 (snap points, modality, breakpoint, side panel width), decision 5 (reduced motion), overturned default 2; evidence "Bottom sheet".
- Spec `.scratch/house-cost-here-mvp/spec.md`, sections "Map" (bottom sheet default) and "House List"; user stories 13, 14, 23, 37, 44.
- `.scratch/house-cost-here-mvp/issues/00-README.md`, "Page structure on phones"; tickets 08, 09, 10.
