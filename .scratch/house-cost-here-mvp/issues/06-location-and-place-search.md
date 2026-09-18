# 06 Location, URL state and place search

Status: done
Type: task
Blocked by: 03

## Goal

Spec section "Location"; user stories 1 to 9. Build the location flow in the Nuxt app without the map.

## Scope

- `app/composables/useLocation.ts`: reads and writes `lat`, `lng`, `r`, `h` from the route query (URL is the source of truth; use `router.replace` for updates). Exposes `location`, `radius`, `selectedHouseId`, `setLocation`, `setRadius`, `select`. Rounds to 4 decimals before writing. Radius options and default per `00-README.md` (read from `docs/research/mobile-map-ux.md` if ticket 01 has landed and update the constants).
- `app/composables/useGeolocation.ts`: wraps `navigator.geolocation`. States: `unsupported`, `idle`, `requesting`, `granted`, `denied`, `error`. `locate()` requests a single position with a 10 s timeout. Nothing is sent to a server except the rounded Location via the URL.
- `app/components/LocationPrompt.vue`: shown on load when the URL carries no Location. One sentence explaining why, a primary "Use my location" button that triggers the request straight away on mount (the spec asks for an immediate prompt; also keep the button for retry), and the place-search box beneath it for denial or absence.
- `app/components/PlaceSearch.vue`: Nuxt UI input with debounced calls to `/api/geocode`, a result list, keyboard operable, selecting a result writes the URL.
- `app/components/LocateMeButton.vue`: reusable control for the map ticket.
- `app/pages/index.vue` (create if missing): if no Location, render `LocationPrompt`; if Location present, render a placeholder "Location set" panel with `PlaceSearch` for changing it. Ticket 08 replaces this placeholder with the One-Pager.
- Component tests with `@nuxt/test-utils/runtime` (`mountSuspended`) for the composable and prompt states; browser e2e coverage is ticket 12.

## Acceptance

- Opening `/` shows the prompt and requests geolocation immediately; `/?lat=52.3676&lng=4.9041` skips it.
- `pnpm quality` green.

## Comments

- Done. `pnpm quality` green; 16 web unit tests (`use-location`, `use-geolocation`, `location-prompt`, `place-search`, plus the app shell). No new dependencies. SSR of `/` and `/?lat=52.3676&lng=4.9041` checked against a dev server.
- `useLocation()` (`app/composables/useLocation.ts`): `location: ComputedRef<Location | null>` (rounded to 4 decimals on read), `radius: ComputedRef<250 | 500 | 1000>` (default 500, unknown values fall back), `radiusOptions`, `selectedHouseId: ComputedRef<string | null>`, `setLocation(loc)` (rounds, writes `lat`/`lng` with `toFixed(4)`, drops `h`), `setRadius(r)`, `select(id | null)`. All writers use `router.replace` and return its promise. Exports `RADIUS_OPTIONS`, `DEFAULT_RADIUS`, `parseLocation(query)`, `parseRadius(query)` for server or middleware reuse.
- `useGeolocation()` (`app/composables/useGeolocation.ts`): `status: Ref<'unsupported' | 'idle' | 'requesting' | 'granted' | 'denied' | 'error'>`, `position: Ref<Location | null>` (already rounded), `locate(): Promise<Location | null>`. State lives in `useState` so the prompt, `LocateMeButton` and the map share one status; concurrent `locate()` calls join the in-flight request. 10 s timeout, `maximumAge` 60 s. Starts `idle` on both server and client; `unsupported` is only discovered when `locate()` runs, which avoids a hydration mismatch. Tests call `clearNuxtState()` in `beforeEach`.
- Components: `LocationPrompt` (no props; calls `locate()` in `onMounted`, then `setLocation`; shows `PlaceSearch` on denied/unsupported/error and hides the button when unsupported). `PlaceSearch` (props `debounceMs` 400, `minLength` 2, `autofocus`; emits `select(GeocodeResult)`; hand-rolled combobox on `UInput` with `role="combobox"`, `aria-activedescendant`, 48 px options; debounced `$fetch('/api/geocode', { query: { q } })`, Enter searches at once, stale responses are dropped). `LocateMeButton` (props `label?`, `block?`; icon-only 48 px square without a label; emits `located(Location)` and `failed(status)`).
- Note for ticket 05: the search box calls `/api/geocode` per debounced keystroke (minimum 2 characters, 400 ms). Nominatim's usage policy forbids autocomplete, so the server route should cache by query and rate-limit, or the debounce should be raised and `minLength` increased; both are props.
