# 07 Map component

Status: done
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

## Comments

- Done. `pnpm quality` green (fmt, lint, `nuxt typecheck`, knip, 20 web unit tests across three files). `maplibre-gl` added to `apps/web` as `^6.10.0` (caret per the policy change during this ticket; resolves to 6.10.0). `@nuxt/scripts` removed from `apps/web/nuxt.config.ts` and `package.json`: nothing called `useScript` (research decision 5 overturned it) and the `00-README.md` rule says to drop it then; recorded in `../versions.md`.
- Component API. Use `HouseMapFrame.vue` (SSR-safe); it wraps `HouseMap.client.vue` in `<ClientOnly>` with `MapPlaceholder.vue` as the `#fallback`. Props: `centre: Location`, `radiusMetres: number`, `houses: MapHouse[]` (`House & { priceSignal?: PriceSignal | null }`, the shape ticket 08 produces), `selectedHouseId?: string | null`, `userPosition?: Location | null`, `amenityFocus?: Location | null`, `countryCode?: string` (locale for the price pills), `peekHeight?: string` (default `15dvh`; pass `0px` at `>= 840px`), `testHook?: boolean`. Emits: `select(houseId | null)` (marker tap, or tap on empty map while something is selected), `search-here(centre)` (the "Search here" pill after a drag, and the locate-me button with the device position rounded to 4 decimals; the page sets both `centre` and `userPosition`), `radius-change(metres)`. Slot `locate` (scoped `{ locate, locating }`) replaces the built-in locate button with ticket 06's `LocateMeButton`.
- Layout: the frame is `100dvh` tall (research overturned default 2: the sheet overlays the map); override with `--house-map-height`. Controls are 48 px with 8 px gaps on the right edge, bottom at `calc(peek + 16px + env(safe-area-inset-bottom))`; the "Search here" pill and the desktop `NavigationControl` sit at `calc(env(safe-area-inset-top) + var(--house-map-top-offset, 16px))`, so ticket 08 sets `--house-map-top-offset` to its header height. Camera moves use the same insets as padding, so the Search Area and a selected House land in the visible strip between header and sheet. Selecting a House hidden in a cluster eases to z17 (`clusterMaxZoom + 1`).
- Behaviour per the research: `clusterRadius: 56`, `clusterMaxZoom: 16`, 48 px tap box via `queryRenderedFeatures`, pills via `icon-text-fit` on a generated stretchable image, plain outlined circle without a Price Signal, orange selected pill; `touchPitch`/`pitchWithRotate` off, `maxPitch: 0`, compact attribution bottom-left capped so it never runs under the radius group; dark mode follows `useColorMode()` through `map.setStyle(url, { transformStyle })` that carries the app sources and rebuilds the layers for the dark palette; reduced motion gives 0 ms camera moves and `fadeDuration: 0`; fonts are read from the loaded style (`noto_sans_bold` on VersaTiles).
- Pure helpers under `app/utils/map/` (`geojson.ts`, `layers.ts`, `pill.ts`, `radius.ts`, `summary.ts`, `types.ts`) are unit-tested in `test/unit/map-utils.test.ts`; `test/unit/house-map-frame.test.ts` mounts the frame with `HouseMap` stubbed and checks the `aria-live` summary and the placeholder states. `RADIUS_OPTIONS` lives in `app/utils/map/radius.ts`; ticket 06/08 should import it rather than redeclare.
- Test hook: `window.__houseMap = { select(id), getState() }`, installed on mount when `import.meta.dev || testHook`. `getState()` returns `{ status: 'loading' | 'ready' | 'error', centre (visible-area centre, 4 decimals), zoom, radiusMetres, houseCount, selectedHouseId, searchHereVisible, theme }`. `select(id)` emits like a marker tap. Ticket 12 runs against a production build, so ticket 08 must pass `testHook` (suggested: a `public.testHooks` runtime config read from `NUXT_PUBLIC_TEST_HOOKS`). `data-testid`s: `house-map-frame`, `map-placeholder`, `house-map` (with `data-status`), `search-here`, `locate-me`, `radius-control`.
- Dev gotcha: `vite.optimizeDeps.exclude: ['maplibre-gl']` in `nuxt.config.ts`. Vite's pre-bundler does not copy `maplibre-gl-worker.mjs`, so without it the style loads but `load` never fires in `pnpm dev`. `.oxlintrc.json` allows the `__houseMap` name for `no-underscore-dangle`.
- Manual check: a temporary `app/pages/map-demo.vue` (deleted, not committed) fed `createFixtureProvider()` Houses plus Price Signals for Amsterdam, radius 500, into `HouseMapFrame`. Playwright (headless Chromium, 390x844, 2x) with the dev server on port 3077: the SSR placeholder showed the grid, "122 houses within 500 m of 52.3676, 4.9041", spinner and "Loading map (3/3)"; the map reached `ready` in about 2.5 s; light and dark (eclipse) styles both drew the translucent circle, seven teal clusters (6 to 26), the 48x48 locate button and the three radius buttons ending 16 px above 15dvh; `__houseMap.select(firstId)` zoomed to z17 and showed white/teal pills (`€ 1M`, `€ 764k`, `€ 509k`), the orange selected pill (`€ 602k`) and an outlined circle for a House without a price; a touch drag showed the "Search here" pill top centre. No console errors.
