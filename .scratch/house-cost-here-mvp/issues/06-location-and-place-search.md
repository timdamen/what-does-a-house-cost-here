# 06 Location, URL state and place search

Status: ready-for-agent
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
