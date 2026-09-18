# Pinned versions

Verified against the npm registry on 2026-09-17 with `npm view <pkg> version`. Declare each as a caret range on this version (`^x.y.z`), never an exact pin (user decision on 2026-09-17; the spec originally said exact pins). Deviations are recorded at the bottom with a reason.

| Package | Version |
| --- | --- |
| nuxt | 4.5.2 |
| @nuxt/ui | 4.11.1 |
| @nuxt/image | 2.1.0 |
| @nuxt/fonts | 0.14.0 |
| @nuxt/icon | 2.5.1 |
| @nuxt/scripts | 1.3.9 |
| @nuxt/test-utils | 4.3.2 |
| @nuxt/kit | 4.5.2 |
| vue | 3.5.43 |
| vue-tsc | 3.3.11 |
| typescript | 6.0.3 (see deviations; 7.0.2 does not work with vue-tsc) |
| oxlint | 1.83.0 |
| oxfmt | 0.68.0 |
| knip | 6.36.0 |
| lefthook | 2.1.14 |
| @commitlint/cli | 21.2.2 |
| @commitlint/config-conventional | 21.2.2 |
| vitest | 5.0.1 |
| @vitest/browser | 5.0.1 |
| playwright | 1.63.0 |
| @playwright/test | 1.63.0 |
| playwright-core | 1.63.0 |
| happy-dom | 20.14.5 |
| maplibre-gl | 6.10.0 |
| @tanstack/vue-virtual | 3.13.39 |
| zod | 4.6.5 |
| p-limit | 7.3.2 |
| ofetch | 1.5.1 |
| @vueuse/core | 15.0.0 |
| @vueuse/nuxt | 15.0.0 |
| @iconify-json/lucide | 1.2.133 |
| @types/node | 26.6.1 |
| @lhci/cli | 0.15.1 |
| lighthouse | 13.4.1 |
| unstorage | 1.17.5 |

Notes:
- `@nuxt/devtools` latest is `4.0.0-beta.1`; Nuxt 4 bundles devtools, so it is not pinned separately. Enable with `devtools: { enabled: true }`.
- `h3` latest tag is a release candidate (`2.0.1-rc.32`); use whatever Nuxt 4.5.2 depends on, do not pin it.
- `@nuxt/test-utils` 4.3.2 peers: `vitest ^5`, `happy-dom >=20.0.11`, `@playwright/test ^1.43.1`.

## Deviations

- `typescript` 7.0.2 -> 6.0.3 (ticket 02). TypeScript 7 is the Go compiler and no longer ships the JavaScript compiler API (`typescript/lib/tsc`), which `vue-tsc` 3.3.11 (and therefore `nuxt typecheck`) requires. 6.0.3 is the newest release that still does.

## Additions

Pinned in ticket 02, verified with `npm view` on 2026-09-17:

| Package | Version | Reason |
| --- | --- | --- |
| vue-router | 5.3.1 | Direct dependency of `apps/web` so the generated `.nuxt/tsconfig` can resolve `vue-router/volar/sfc-route-blocks` under pnpm's strict `node_modules`. |
| tailwindcss | 4.3.3 | Direct dependency of `apps/web` so `@import 'tailwindcss'` in `main.css` resolves under pnpm (it is only a transitive dependency of `@nuxt/ui`). |
| @vue/test-utils | 2.5.1 | Peer of `@nuxt/test-utils` needed by `mountSuspended`. |

Pinned in ticket 05:

| Package | Version | Reason |
| --- | --- | --- |
| zod | 4.6.5 | Direct dependency of `apps/web` for query and body validation in the server routes (already in the table above; added here when it became a real dependency). |

Pinned in ticket 04, verified with `npm view` on 2026-09-17:

| Package | Version | Reason |
| --- | --- | --- |
| p-limit | 7.3.2 | Concurrency limit in the `@house-cost/open-data` HTTP client (already listed above; now a dependency of `packages/open-data`). |
| @types/node | 26.6.1 | devDependency of `packages/open-data` so `fetch`, `Response` and `node:fs` (recording script) typecheck under pnpm's strict `node_modules`; same version as `apps/web`. |

Ticket 07 (2026-09-17):

| Package | Version | Reason |
| --- | --- | --- |
| maplibre-gl | ^6.10.0 | Direct dependency of `apps/web`, imported dynamically inside `HouseMap.client.vue`. Declared with a caret per the dependency policy change during ticket 07; resolves to 6.10.0. |

Ticket 09 (2026-09-17):

| Package | Version | Reason |
| --- | --- | --- |
| @tanstack/vue-virtual | ^3.13.39 | Direct dependency of `apps/web`; `useVirtualizer` virtualises `HouseList.vue` above 50 rows with the sheet body as the scroll element (user story 30). Verified with `npm view` on 2026-09-17; resolves to 3.13.39. |

## Removals

- `@nuxt/scripts` 1.3.9 (ticket 07). Research decision 5 overturned loading MapLibre through `useScript`; nothing in the app called `useScript` or read `$scripts`, so the module is gone from `apps/web/nuxt.config.ts` and `apps/web/package.json`. Re-add it only if a third-party tag is ever needed.

- `@nuxt/fonts` 0.14.0 removed (fix pass after the code review, 2026-09-17). The module was
  installed but declared no font, so it did nothing. Declaring Inter as `--font-sans` (self-hosted,
  `font-display: swap`, upright latin faces only) added about 225 ms to the simulated
  first-contentful-paint in the Lighthouse CI run (`/` 2255 ms -> 2480 ms, deep link LCP
  2413 ms -> 2628 ms) and broke the 2.5 s LCP budget on both URLs: Lighthouse's throttling folds
  every request started before first paint into its estimate, so any web font costs it, whatever
  its `font-display`. Nuxt Fonts cannot set `font-display: optional` for provider fonts either.
  The UI keeps Tailwind's system font stack, which the spec's "self-hosted or open hosts" allows.
  Re-add the module together with a raised budget if a brand font is ever wanted.
