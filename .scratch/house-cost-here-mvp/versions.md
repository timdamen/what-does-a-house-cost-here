# Pinned versions

Verified against the npm registry on 2026-09-17 with `npm view <pkg> version`. Pin exactly (no `^`). Deviations are recorded at the bottom with a reason.

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
| typescript | 7.0.2 (fallback 6.0.3 if vue-tsc or oxlint cannot use 7) |
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

(none yet)
