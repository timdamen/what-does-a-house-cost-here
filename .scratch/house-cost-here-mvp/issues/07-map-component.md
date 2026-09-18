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
