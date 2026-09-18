# 07 Map component

Status: ready-for-agent
Type: task
Blocked by: 01, 03

## Goal

Spec section "Map"; user stories 10 to 22. Build `app/components/HouseMap.client.vue` as a client-only, lazily loaded MapLibre map.

## Scope

- Load `maplibre-gl` through `@nuxt/scripts` (`useScript` with a self-hosted or jsDelivr URL for the pinned version; CSS included) so it never blocks first paint. Until loaded, show a skeleton placeholder with a progress indicator.
- Props: `centre: Location`, `radiusMetres: number`, `houses: House[]`, `selectedHouseId: string | null`, `userPosition: Location | null`, `amenityFocus: Location | null`. Emits: `select(houseId | null)`, `search-here(centre: Location)`, `radius-change(metres)`.
- Houses as a GeoJSON source with `cluster: true`; cluster circles with counts; unclustered points as a symbol layer showing the abbreviated Price Signal when present (`text-field` from a `label` property) and a plain marker otherwise. Selected house gets a distinct style.
- Search Area drawn as a translucent circle polygon (compute with the domain geo helper). User position as a distinct dot.
- Controls: navigation (zoom), a locate-me button (from ticket 06, or a local equivalent if 06 has not merged), a radius control offering the fixed options, and a "Search here" pill that appears after the map is dragged more than a few hundred metres from `centre`. All controls at least 44×44 px, bottom placement respecting `env(safe-area-inset-bottom)`, per the research note.
- Dark mode: pick `public.mapStyleDark` when `prefers-color-scheme: dark` (or Nuxt UI colour mode) and switch style on change. Reduced motion: `prefers-reduced-motion` disables `flyTo` animations (`jumpTo` instead) and the cluster expansion animation.
- Map summary for assistive tech: a visually hidden `aria-live` region stating how many houses are shown and the current centre, plus `role="application"` labelling on the canvas container.
- Fits on a phone: 100 dvw × 60 dvh minimum above the fold.
- A small unit test of the pure helpers (label building, circle polygon) and a component test that the placeholder renders before the script loads.

## Acceptance

- Map renders houses from the fixture provider when given props; clustering, price labels, circle, and controls visible in a manual `pnpm dev` check.
- `pnpm quality` green.

## Updates after research (ticket 01)

Read `docs/research/mobile-map-ux.md` "Decisions" 1, 3, 4, 5, 7 and apply them; they override the scope above where they differ:

- Load MapLibre with a dynamic `import('maplibre-gl')` (and its CSS) in the `.client.vue` component, not with `useScript`. Wrap in `<ClientOnly>` with a server-rendered `#fallback` placeholder of fixed height (`100dvh` minus peek) containing the text summary; spinner after 1 s; "Map failed to load" with retry on error.
- Controls 48×48 px with 8 px gap, right edge, stacked above `calc(peek + 16px + env(safe-area-inset-bottom))`; no zoom buttons or compass on phones; `NavigationControl` only at `>= 840px`. Gestures: `touchPitch: false`, `pitchWithRotate: false`, `maxPitch: 0`. Compact attribution bottom-left above the peek.
- Clustering: `clusterRadius: 56`, `clusterMaxZoom: 16`; tap hit-testing via `queryRenderedFeatures` with a 48 px box. Price pill labels via `Intl` compact currency (domain helper), plain outlined circle without a Price Signal, distinct selected style. Radius options `[250, 500, 1000]`; zoom per radius z16/z15/z14.
- Reduced motion: `easeTo` with `duration <= 300` and never `essential: true`; `fadeDuration: 0` under reduced motion. Dark mode: `map.setStyle(dark, { transformStyle })` re-adding the app's sources and layers.
- Expose a test hook `window.__houseMap = { select(id), getState() }` in dev/test for e2e tests.
