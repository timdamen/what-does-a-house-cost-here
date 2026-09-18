# 0003 The URL is the source of truth for Location, Search Radius and selection

Status: accepted (2026-09-17)

## Context

User stories 6, 7 and 9 ask that the current Location is part of the page URL, that a shared link opens directly on what the sender saw, and that a precise location is never stored on a server. The spec ("Location") states that Location is always reflected in the URL query, that the URL is the source of truth, and that geolocation and search only write to it.

Alternatives: a client store (Pinia or a shared `ref`) mirrored to the URL on change, `localStorage` for the last Location, or a server session. Each adds a second place that can disagree with the address bar and makes deep links and tests harder.

## Decision

- The route query is the only state for Location, Search Radius and the selected House: `/?lat=52.3676&lng=4.9041&r=500&h=<house id>`.
- `useLocation` (`apps/web/app/composables/useLocation.ts`) reads these from the route and writes them with `router.replace`. Every other piece of the app derives from it; nothing caches a Location elsewhere.
- Geolocation and place search are writers only: a granted position or a chosen Geocoder result becomes a URL update, never a store update.
- Latitude and longitude are rounded to 4 decimals (about 11 m) before they are written, so the URL, the client cache key and the server cache key all agree. Server routes round again on entry and never log or persist raw coordinates.
- No Location in the URL means the arrival state (immediate geolocation prompt with the place-search fallback); a Location in the URL skips the prompt entirely.

## Consequences

- Refresh, share and Back all work without any code: the URL carries everything.
- `router.replace` keeps browser history clean; a drag-and-"search here" does not add history entries. Only the Bottom Sheet's full state uses Back (ADR-0006).
- Precision is capped at 4 decimals everywhere. That is fine for a Search Area of 250 m or more and is the privacy floor the spec wants.
- A shared link also carries the selection `h`, so the recipient sees the same House Card.
- Browser e2e tests can start from any state by deep-linking, and the server route tests key their cache assertions on the same rounded values.
- Anything that needs to survive a reload must be expressible in the URL. State that is not (sheet snap point, sort order) is deliberately ephemeral.

## References

- Spec `.scratch/house-cost-here-mvp/spec.md`, section "Location"; user stories 5 to 9.
- `.scratch/house-cost-here-mvp/issues/00-README.md`, "URL state" and "Server routes"; tickets 05 and 06.
