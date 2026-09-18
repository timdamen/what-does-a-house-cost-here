# 12 Browser end-to-end tests

Status: done
Type: task
Blocked by: 09, 10

## Goal

Spec "Testing Decisions › Seam one" browser tests.

## Scope

- `apps/web/test/e2e/*.spec.ts` with `@nuxt/test-utils/e2e` and Playwright, fixture provider, phone viewport (390×844, device scale 3, touch). Fake geolocation through the browser context (`context.grantPermissions`, `context.setGeolocation`) and denial (`clearPermissions` plus a page init script that makes `getCurrentPosition` call the error callback) and absence (init script deleting `navigator.geolocation`).
- Cover: geolocation granted centres on the fixture town; denied and absent show place search and searching a fixture place sets the URL; shared link arrival skips the prompt; tapping a list row selects (URL `h`, sheet open); tapping a marker scrolls the list (drive via the map's exposed test hook `window.__houseMap.select(id)` if canvas hit-testing is unreliable, and say so in a comment); changing the radius updates the URL and the count line; bottom sheet snap points (peek → half → full via drag or the sheet's handle); the Neighbourhood Facts headings in order.
- `pnpm test:e2e` script at root; CI job runs it with Playwright browsers installed.

## Acceptance

- All e2e tests pass locally and in CI.

## Comments

- Done. `pnpm quality` green; `pnpm test:e2e` at the root runs 30 tests in three builds: the 19 route tests from ticket 05 plus 11 browser tests in `apps/web/test/e2e/browser.test.ts` (one `setup()` per file: fixture provider, `runtimeConfig.public.testHooks = true`, `browser: true` with playwright-core's headless Chromium). The full suite takes about 25 s locally (the browser file alone about 20 s); it ran green three times in a row after the fixes below, including once alongside `pnpm quality` for CPU contention. No new dependencies: `@playwright/test` (already a devDependency) supplies the standalone auto-retrying `expect` for locator assertions and `expect.poll`; `playwright-core` supplies the browser.
- Every page opens with `viewport 390x844`, `deviceScaleFactor: 3`, `hasTouch: true`, `isMobile: true`. Geolocation: granted via `permissions: ['geolocation']` + `geolocation` context options (the URL gains `lat=52.3676&lng=4.9041` and the count line appears); denied via `clearPermissions()` plus an init script whose `getCurrentPosition` calls the error callback with `code: 1` (the prompt shows place search; "Sydney" + submit + choosing the option writes `lat=-33.8688&lng=151.2093`); absent via an init script that deletes `Navigator.prototype.geolocation` (place search shown, "Use my location" hidden). A shared link opens the one-pager with the sheet at peek and, checked through a wrapped `getCurrentPosition`, never asks the browser for a position. Also covered: list row tap (`h=` set, sheet lifts to half, card titled with the row's address, close clears it); map selection through `window.__houseMap.select(id)` for a house 60 % down the virtualised list (`h=`, `aria-current`, the row's box inside the sheet body's box, map state follows); radius 500 m -> 250 m (`r=250`, `aria-pressed`, count line 122 -> 40); sheet snaps by keyboard (ArrowUp/Down, Home/End, Escape, heights 126.6 / 422 / 759.6 px) and by a real one-finger drag sent through CDP `Input.dispatchTouchEvent` (peek -> half -> full -> peek, then a tap); the five facts `h3`s in order plus the price summary, amenities and provenance; and the `no-price-data` card on the Sydney deep link with "No price data" in the rows.
- Approximations: marker taps use the `__houseMap.select` hook rather than canvas taps (comment in the test says why: WebGL canvas, clustering at the initial zoom, positions that depend on tile and glyph loading). The radius test shrinks the radius instead of growing it because the fixture town keeps all 122 houses within 500 m, so 1 km cannot change the count. Touch drags go through CDP because Playwright's `Touchscreen` only taps; the test is Chromium-only for that reason (the suite is anyway). The sheet body has no test id, so the "scrolled into view" check locates `.bottom-sheet__body` inside `[data-testid="bottom-sheet"]`.
- Three app defects the tests found, fixed here:
  - `HouseMap.client.vue`: the production build never emitted `maplibre-gl-worker.mjs` (MapLibre resolves it from `import.meta.url`; the request 404ed at `/_nuxt/maplibre-gl-worker.mjs`), so the built map sat on "loading" forever. Every earlier manual check ran against `pnpm dev`, where Vite serves the file. The component now imports `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url` (Vite bundles the worker and the shared chunk it imports as their own entry) and calls `setWorkerUrl()` before creating the map. `vite.optimizeDeps.exclude` is left as it was.
  - `BottomSheet.vue`: after a touch drag the next tap on the handle did nothing. The drag logic set `suppressNextClick` to swallow the trailing click a mouse drag produces, but a touch drag produces none, so the flag swallowed the next real tap. `onPointerDown` now clears it; unit test added in `test/unit/bottom-sheet.test.ts`.
  - `HouseList.vue`: a selection from the map left the row about 36 px below the fold. `revealSelected` scrolled once, during the sheet's 250 ms peek -> half transition and while the card was being inserted above the list, so the virtualiser measured against a 16 px viewport and later re-measurements moved the row out again. The reveal now scrolls once and then, for up to 2 s, scrolls again on any frame that finds the row outside the scroll element; `pointerdown` or `wheel` on the list ends it early so it never fights the user. This is the same class of problem ticket 10 noted for `HouseMap.revealLocation` and the sheet's live height; a `visibleHeight` prop on the map is still open.
- CI: `.github/workflows/ci.yml` installs Chromium with `pnpm --filter @house-cost/web exec playwright install --with-deps chromium` after `pnpm quality` and then runs `pnpm test:e2e`. The browser tests need network access to `tiles.versatiles.org` for the two map-dependent cases (`waitForMap` allows 45 s); the other nine never wait for the map.
- Back collapsing the full sheet (open since ticket 08) is still undecided; nothing here pushes history entries.

