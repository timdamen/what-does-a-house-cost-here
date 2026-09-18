# Spec: What Does a House Cost Here? (MVP)

Status: ready-for-agent
Type: spec
Created: 2026-09-17

## Glossary

There is no `CONTEXT.md` yet. These terms are used consistently below and are candidates for it.

- **Location**: the single geographic point the app is currently centred on. Comes from the device's geolocation or from a place search.
- **Search Area**: the circle around the Location within which Houses and Neighbourhood Facts are gathered. Has a Search Radius.
- **House**: a residential building known to OpenStreetMap inside the Search Area, with whatever address and attributes OSM holds for it.
- **Price Signal**: a sale price or official valuation for a House, or for the street or area it sits in, from an open price register. Price Signals are regional and may be absent.
- **Neighbourhood**: the named area the Location falls in, as reverse geocoding reports it, plus everything the app knows about that area.
- **Neighbourhood Facts**: the amenities, transport, schools, green space, and price summary the app shows for a Neighbourhood.
- **One-Pager**: the single page holding the map, the house list, and the Neighbourhood Facts. It is the whole app.
- **Data Provider**: any external source of Houses, Price Signals, or Neighbourhood Facts, reached through the single provider port.

## Problem Statement

When someone stands somewhere, or is thinking about moving somewhere, they want a fast answer to one question: what does a house cost here, and what is it like to live here? Today they must open several apps, type an address, zoom and pan around a heavy desktop-first map, and piece the answer together from listings sites, statistics portals, and their own walking around. On a phone, on a mobile connection, that is slow and frustrating.

## Solution

A single-page mobile-first web app. On first visit it asks for your location straight away. As soon as a Location is set it shows a fast, good-looking map of the Houses around you, with prices where open data has them. Beneath the map the same Houses appear as a list, followed by the Neighbourhood Facts a buyer would want: what the area is called, what is nearby, how you get around, and what homes have sold for. Everything comes from open data, works worldwide, and degrades honestly where a region has no price data.

Before the map UI is built, a short research pass establishes the best mobile map UX and its findings are recorded in the repo. The defaults below are stated so the research has something concrete to confirm or overturn.

## User Stories

### Arrival and Location

1. As a first-time visitor on a phone, I want the app to ask for my location immediately on load, so that I don't have to find a button before I get any value.
2. As a visitor who grants location access, I want the map to appear and centre on me automatically, so that the answer arrives with zero further taps.
3. As a visitor who denies location access, I want a clear place-search box instead, so that I can still use the app by typing a town, street, or postcode.
4. As a visitor whose browser has no geolocation, I want the same place-search fallback, so that the app never dead-ends.
5. As a visitor, I want to change my Location later by searching or by dragging the map and tapping "search here", so that I can explore areas I am not standing in.
6. As a visitor, I want the current Location to be part of the page URL, so that refreshing keeps my place and I can send the link to someone.
7. As a visitor opening a shared link, I want the app to skip the location prompt and load that Location directly, so that the link shows what the sender saw.
8. As a visitor, I want to tap a "locate me" control at any time, so that I can jump back to where I am.
9. As a privacy-conscious visitor, I want my precise location never stored on a server, so that using the app doesn't build a record of where I have been.

### Map

10. As a phone user, I want the map to fill the screen above the fold and respond instantly to pinch, drag, and rotate, so that it feels like a native map.
11. As a phone user, I want Houses shown as price-labelled markers when a Price Signal exists and as plain markers otherwise, so that I can see at a glance what costs what.
12. As a phone user, I want nearby markers to cluster when zoomed out and split apart when I zoom in, so that dense areas stay readable.
13. As a phone user, I want to tap a marker and see a compact card for that House without leaving the map, so that I can scan many homes quickly.
14. As a phone user, I want the house card to sit in a bottom sheet I can drag between peek, half, and full height, so that the map stays visible while I read.
15. As a phone user, I want the Search Area drawn on the map, so that I understand which homes are included.
16. As a phone user, I want a control to widen or narrow the Search Radius, so that I can trade breadth for detail.
17. As a phone user, I want the map to show my position as a distinct dot, so that I can relate homes to where I am.
18. As a phone user, I want map controls large enough to hit with a thumb and placed away from the browser chrome, so that I don't mis-tap.
19. As a visitor with reduced-motion preferences, I want map animations shortened or removed, so that the app respects my settings.
20. As a visitor in dark mode, I want a dark map style and UI, so that the app matches my device.
21. As a visitor, I want the map to load only after my Location is known and the rest of the page is usable, so that the first paint is fast.
22. As a visitor on a slow connection, I want a placeholder and progress indication where the map will be, so that I know something is happening.

### House List

23. As a visitor, I want the same Houses shown as a scrollable list beneath the map, so that I can read them one by one.
24. As a visitor, I want each list row to show the address, the building type, the Price Signal if any, and the distance from my Location, so that I can compare at a glance.
25. As a visitor, I want the list sorted by distance by default, with a switch to sort by price, so that I can see nearest or cheapest first.
26. As a visitor, I want tapping a list row to highlight and centre that House on the map, so that list and map stay in sync.
27. As a visitor, I want tapping a map marker to scroll the list to that House, so that the sync works both ways.
28. As a visitor, I want Houses with no Price Signal marked "no price data" rather than hidden, so that I still see what exists around me.
29. As a visitor, I want the list to say plainly how many Houses were found and how many have a Price Signal, so that I know how complete the picture is.
30. As a visitor, I want the list to render quickly even with several hundred Houses, so that scrolling stays smooth.

### Neighbourhood Facts

31. As a visitor, I want to see the Neighbourhood's name and the place hierarchy it sits in (suburb, city, region, country), so that I know where I am.
32. As a visitor, I want a price summary for the Neighbourhood (typical, low, high, and how recent the data is), so that I can judge affordability before looking at single homes.
33. As a visitor, I want to see nearby schools, supermarkets, healthcare, parks, and public transport with walking distances, so that I can judge daily life here.
34. As a visitor, I want a short breakdown of housing types in the Search Area (detached, terraced, apartments), so that I understand the character of the area.
35. As a visitor, I want to see when the Neighbourhood data was last fetched and where it came from, so that I can trust it or not.
36. As a visitor in a region without an open price register, I want the price summary replaced by a clear "no open price data for this region yet" note, so that I am not misled by empty numbers.
37. As a visitor, I want the Neighbourhood Facts grouped under short headings with the most decision-relevant first, so that the One-Pager reads top to bottom as a buyer's brief.
38. As a visitor, I want tapping an amenity to show it on the map, so that facts and map connect.

### Performance and Reliability

39. As a phone user on 4G, I want the page interactive within a couple of seconds, so that I don't give up before the map loads.
40. As a visitor, I want data for an area I recently looked at to reappear instantly, so that going back is free.
41. As a visitor, I want upstream open-data outages to produce a clear retry message rather than a blank page, so that I know it's them, not me.
42. As an operator, I want upstream open-data services called through my own server with caching and a proper identifying User-Agent, so that the app respects their usage policies and stays within limits.
43. As an operator, I want a performance budget enforced in CI, so that the app can't quietly get slow.

### Accessibility and Internationalisation

44. As a screen-reader user, I want the house list and Neighbourhood Facts fully navigable and the map summarised in text, so that I get the same answer without the map.
45. As a keyboard user, I want every control reachable and operable, so that the app works without touch.
46. As a visitor anywhere in the world, I want prices shown in the local currency and units in the local system, so that numbers make sense where I am.

### Engineering

47. As a developer, I want a pnpm monorepo with the web app and the data layer as separate packages, so that the data layer can be reused and tested without Nuxt.
48. As a developer, I want oxlint, oxfmt, typechecking, and knip to run on every commit and push through lefthook, so that quality is enforced without remembering to run anything.
49. As a developer, I want commit messages checked against Conventional Commits, so that history stays readable and releasable.
50. As a developer, I want a fixture Data Provider selectable by config, so that tests and local development need no network.
51. As a developer, I want the mobile map UX research saved in the repo, so that its conclusions outlive the chat that produced them.

## Implementation Decisions

### Order of work

- Work starts with the research pass. It is done with the `research` skill, targets primary sources on mobile map UX (platform HIG and Material guidance, MapLibre and Mapbox mobile docs, published usability findings), and is saved as a Markdown file under the repo's docs. Its conclusions may overturn any "default" below; where they do, the ADR records why.
- Monorepo, tooling, and the data layer come next, then the One-Pager.

### Monorepo

- pnpm workspaces. Two workspace groups: apps and packages.
- One app: the Nuxt web app.
- Two packages: a domain package holding the types, the Data Provider port, geo helpers, and the fixture provider; and an open-data package holding the real adapters (OpenStreetMap, Nominatim, Overpass, and the regional price registers).
- Shared TypeScript, oxlint, and oxfmt configuration lives at the root and is extended by each workspace.
- All packages use the latest stable version of every dependency at the time of scaffolding, verified against the registry rather than recalled from memory. Versions use caret ranges (`^x.y.z`) on the latest stable release so patch and minor updates are picked up; `packageManager` stays exact.

### Nuxt and official modules

- Latest stable Nuxt. Only official Nuxt-org modules are used for framework concerns: Nuxt UI for components (bottom sheet, cards, skeletons, inputs, toasts), Nuxt Image for any raster imagery, Nuxt Fonts for self-hosted fonts, Nuxt Icon for icons, Nuxt Scripts for lazy-loading the map library, Nuxt Test Utils for tests, and Nuxt DevTools in development.
- Nuxt ESLint is deliberately not used because the user chose oxlint. This is the one departure from the official set and is recorded in an ADR.
- The page shell, list, and Neighbourhood Facts are server-rendered. The map is client-only and loaded lazily after Location is known.

### Map

- Default map library: MapLibre GL JS with vector tiles, loaded through Nuxt Scripts so it never blocks first paint. Vector tiles are chosen for smooth pinch-zoom and small transfer on phones; no API key is required with an open tile host.
- Default tile source: an open vector tile host with light and dark styles. The style URL is runtime config so it can be swapped.
- Clustering uses the map library's built-in GeoJSON clustering. Marker labels show the Price Signal in local currency, abbreviated.
- The map component exposes a small interface: centre, radius, houses, selected house id, and events for selection and "search here". Everything else stays inside it.
- Bottom sheet with three snap points (peek, half, full) is the default container for the selected House card; on wide screens it becomes a side panel. The research pass confirms or changes this.

### Location

- On load, if the URL carries no Location, the browser Geolocation API is requested immediately with a short, plain explanation in the UI. Denial or absence shows the place-search box, backed by Nominatim through the app's own server.
- Location is always reflected in the URL query. The URL is the source of truth; geolocation and search only write to it.
- Locations are rounded to a few decimals before being sent to the server, and never persisted server-side.
- Default Search Radius is set by the research pass; the control offers a small set of fixed radii rather than a free slider.

### Data Provider port

- One port, in the domain package, with three operations: search houses within a Search Area, get Neighbourhood Facts for a Location, and get Price Signals for a set of Houses. Each returns plain typed data plus provenance (source name, fetched-at time).
- Two implementations: the fixture provider (deterministic, offline, used by tests and local development) and the open-data provider (composes the adapters below). The active provider is chosen by runtime config.
- Houses come from Overpass queries for residential building types within the Search Area, capped at a fixed maximum per request with the cap reported to the UI.
- Neighbourhood name and hierarchy come from Nominatim reverse geocoding. Amenities and transport come from a second Overpass query for a fixed list of amenity classes, with walking distance estimated from straight-line distance.
- Price Signals come from a registry of regional adapters keyed by country or region. The MVP ships the registry, the fixture adapter, and one real adapter for a region whose open price register has a public HTTP query interface. Regions without an adapter return "no data" as a normal value, not an error. Adding regions is a follow-up ticket per region.
- Currency and locale formatting derive from the country reported by reverse geocoding.

### Server routes and caching

- The Nuxt app exposes three server routes mirroring the three port operations. The browser never calls open-data services directly.
- Responses are cached server-side keyed on a rounded location and radius, with a TTL of hours for Houses and Facts and a day for Price Signals. A client-side cache keyed the same way makes revisiting instant.
- All upstream calls carry an identifying User-Agent and honour each service's published rate limits with a small concurrency limit.
- Upstream failures return a typed error the UI turns into a retry message.

### Performance

- Budgets: interactive on a mid-range phone over simulated 4G within a few seconds, and initial JavaScript well under the map library's own size. Exact numbers are set in the research pass and enforced by a Lighthouse run in CI that fails the build.
- The house list virtualises rows above a modest count.
- Map style, fonts, and icons are self-hosted or from open hosts with long cache headers.

### Quality tooling

- oxlint for linting, oxfmt for formatting, `nuxt typecheck` (vue-tsc) for the app and `tsc` for the packages, knip for dead code and unused dependencies.
- lefthook runs oxfmt and oxlint on staged files at pre-commit; typecheck, knip, and unit tests at pre-push; and commitlint with the conventional config at commit-msg.
- A single root script runs the whole quality suite, and CI runs the same script.

### Domain docs

- The glossary above seeds `CONTEXT.md`. ADRs are written for: oxlint over Nuxt ESLint, MapLibre with vector tiles, URL as Location source of truth, the Data Provider port, and the regional price adapter registry.

## Testing Decisions

- A good test drives the app from the outside and asserts what a user or an API caller would observe. Tests do not reach into components, stores, or adapter internals.
- **Seam one, the app boundary.** Nuxt Test Utils in end-to-end mode. Server route tests call the three routes with the fixture provider active and assert response shapes, caching headers, and the "no price data" and upstream-failure cases. Browser tests run at a phone viewport and cover: geolocation granted, denied, and absent; shared-link arrival; marker and list selection sync; radius change; bottom sheet snap points; and the Neighbourhood Facts headings. Geolocation is faked through the browser context.
- **Seam two, the Data Provider port.** Unit tests in the domain and open-data packages run against recorded upstream responses, asserting the port's typed output, the house cap, the regional registry's "no data" path, and provenance fields. No test hits the network.
- The fixture provider is itself covered by a contract test that both providers must pass, so a real adapter cannot drift from what the UI expects.
- Performance is tested by the CI Lighthouse run against the built app with the fixture provider.
- Prior art: none. The repo is empty; these tests set the pattern.

## Out of Scope

- Real estate listings from commercial marketplaces, or any non-open data source.
- User accounts, saved searches, favourites, alerts, or any persistence across devices.
- Mortgage, affordability, or tax calculators.
- Native iOS or Android apps.
- Historical price charts beyond the summary numbers.
- Price adapters for more than one region in the MVP; each further region is its own ticket.
- Desktop-specific layouts beyond the map-plus-side-panel fallback.
- Translation of the UI itself; only numbers, currency, and units are localised.

## Further Notes

- The name promises a price and open data cannot always deliver one. The "no open price data for this region yet" state is a first-class design element, not an error, and must look intentional.
- Overpass and Nominatim are shared community services with strict usage policies. Server-side proxying, caching, and a real User-Agent are requirements, not optimisations. If traffic grows, self-hosting these or paying for a mirror is the expected follow-up.
- The research pass should also produce the exact performance budget and the default Search Radius, since both are UX decisions best grounded in evidence.
- Per the local issue tracker convention, implementation tickets for this spec go in `issues/` beside this file, one file per ticket, numbered from 01.

## Comments
