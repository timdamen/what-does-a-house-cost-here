# 12 Browser end-to-end tests

Status: ready-for-agent
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
