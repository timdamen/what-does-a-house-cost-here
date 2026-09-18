# 08 One-Pager shell and data loading

Status: ready-for-agent
Type: task
Blocked by: 05, 06, 07

## Goal

Assemble the page: location flow, map, and the data plumbing that the list (09) and facts (10) tickets consume. User stories 21, 22, 39, 40, 41, 46.

## Scope

- `app/pages/index.vue`: server-rendered shell. With no Location: `LocationPrompt`. With a Location: header bar (app name, `PlaceSearch` trigger, `LocateMeButton`), `HouseMap` (client-only, lazy), then two named regions `<section id="houses">` and `<section id="neighbourhood">` with skeletons that tickets 09 and 10 fill. Wide screens (research breakpoint): map left, sections right.
- `app/composables/useHouses.ts`, `useFacts.ts`, `usePrices.ts`: `useFetch`/`useAsyncData` against the routes, keyed on rounded lat/lng/radius, with a client-side cache (Nuxt payload plus `useNuxtData` or a small module-level `Map`) so revisiting a recent area is instant. Prices are fetched after houses and merged into `House.priceSignal`.
- `app/composables/useLocaleFormat.ts`: currency and distance formatting derived from `facts.hierarchy.countryCode` (metric vs imperial for `US`, `GB` miles for long distances; use `Intl`). Wraps the domain helpers.
- Error state: an `UpstreamError` response renders a `ErrorRetry.vue` card ("Open data service unavailable, it's them not you") with a retry button; never a blank page.
- Loading: skeletons for map, list and facts; the page is interactive before the map script loads.
- Wire `search-here`, `radius-change`, `select` from the map to `useLocation`.

## Acceptance

- Manual check with the fixture provider: prompt, map, skeleton sections, retry state (use the failing provider switch from ticket 05).
- `pnpm quality` green.
