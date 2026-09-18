# 0002 MapLibre GL JS with vector tiles from VersaTiles, loaded by dynamic import

Status: accepted (2026-09-17)

## Context

The spec ("Map") set MapLibre GL JS with vector tiles as the default, loaded through Nuxt Scripts, on an open tile host with light and dark styles, and asked the research pass to confirm or overturn it. The research note `docs/research/mobile-map-ux.md` (decisions 1, 6 and 7; overturned defaults 1 and 5) confirmed the library and host and overturned the loading mechanism and the Search Radius options.

Alternatives considered: raster tiles (larger transfer, no smooth pinch-zoom, no style diffing), Leaflet (raster-first), Mapbox GL JS (API key and billing), and for hosting OpenFreeMap (no key, but its light and dark styles share 5 of 111 layer ids, so a dark-mode switch is a full rebuild).

## Decision

- Library: MapLibre GL JS 6.10.0 with vector tiles. Symbol layers, built-in GeoJSON clustering and style diffing are all needed and all built in.
- Tile host: VersaTiles. Light style `https://tiles.versatiles.org/assets/styles/colorful/style.json`, dark style `https://tiles.versatiles.org/assets/styles/eclipse/style.json`. No API key, CORS `*`, six-hour cache headers, and both styles have identical layer ids so dark mode is a diff via `map.setStyle(url, { transformStyle })`. Both URLs live in runtime config (`public.mapStyleLight`, `public.mapStyleDark`) so the host can be swapped; OpenFreeMap is the documented fallback.
- Loading: a dynamic `import('maplibre-gl')` (and its CSS) inside a `.client.vue` component wrapped in `<ClientOnly>` with a server-rendered `#fallback` placeholder, run only after Location is known. Not Nuxt Scripts: `useScript` injects a script URL and suits third-party tags, while maplibre-gl 6 ships ESM only (no UMD `dist/maplibre-gl.js`). Vite emits the import as its own chunk, so nothing lands in the entry bundle.
- Search Radius options: `[250, 500, 1000]` metres, default 500. The 2000 m step from the original ticket defaults is dropped: building counts grow with r² (Amsterdam centre 27,778 buildings at 2000 m, about 10 MB per uncached Overpass query), the map would sit at z13 where VersaTiles draws no building footprints, and 2000 m is a 25-minute walk. Each remaining step is one zoom level (z16, z15, z14).

## Consequences

- MapLibre is a separate chunk of about 148 kB gzip. The performance budget (ticket 13) is 100 kB of script on `/` and 280 kB on a deep link; the map must never join the entry bundle.
- The whole One-Pager works before and without the map: the placeholder holds the text summary and the list and facts stay usable if the map fails.
- `@nuxt/scripts` stays installed only if something else uses it; otherwise it is removed and the ticket says why.
- VersaTiles publishes no fair-use policy page. Attribution is required and the compact `AttributionControl` stays visible above the sheet. If the host disappears, only the two runtime-config URLs change.
- MapLibre's default 29 px controls fail every touch-target guideline and are overridden to 48 px (research decision 3, overturned default 3).
- At 1000 m the house cap (300 per request) is exceeded in every urban sample, so the "showing the first N" message does the honest work the dropped 2000 m option would have needed anyway.

## References

- `docs/research/mobile-map-ux.md`: decisions 1, 3, 5, 6, 7; overturned defaults 1, 3 and 5; evidence "Radius", "Tile hosts", "Loading", "Performance".
- Spec sections "Map", "Location" and "Performance"; user stories 10 to 22, 39.
- `.scratch/house-cost-here-mvp/issues/00-README.md`, "Radius options", "MapLibre loading", "Map tiles"; ticket 07.
