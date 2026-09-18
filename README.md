# What does a house cost here?

Open-data house prices for wherever you are standing. A mobile-first Nuxt app backed by
OpenStreetMap, Nominatim, Overpass and regional open price registers.

## Layout

pnpm workspaces, Node 24 (`.nvmrc`), `pnpm@10.32.1` (`packageManager`).

| Workspace            | Package                 | Purpose                                                   |
| -------------------- | ----------------------- | --------------------------------------------------------- |
| `apps/web`           | `@house-cost/web`       | Nuxt 4 app (`app/` layout, `server/` routes)              |
| `packages/domain`    | `@house-cost/domain`    | Types, Data Provider port, geo helpers, fixture provider  |
| `packages/open-data` | `@house-cost/open-data` | Real adapters (OSM, Nominatim, Overpass, price registers) |

The packages ship TypeScript source: their `exports` point at `src/index.ts`, with no build step.
Vite, Nitro and vue-tsc all consume the source directly through the workspace symlink, so there is
nothing to rebuild while developing and the packages need no `dist/`.

## Scripts

```sh
pnpm install          # also installs the git hooks (lefthook)
pnpm dev              # nuxt dev for apps/web
pnpm build            # nuxt build for apps/web
pnpm quality          # fmt:check + lint + typecheck + knip + test (CI runs the same)
pnpm fmt              # oxfmt --write
pnpm test:e2e         # server-route and phone-browser tests against a built app
pnpm lighthouse       # build, then the Lighthouse CI performance budget
```

## Quality tooling

- Formatting: oxfmt (`.oxfmtrc.json`).
- Linting: oxlint (`.oxlintrc.json`). No ESLint, by decision (see `docs/adr/`).
- Types: `nuxt typecheck` (vue-tsc) in the app, `tsc --noEmit` in the packages, all extending
  `tsconfig.base.json`.
- Dead code and unused dependencies: knip (`knip.json`).
- Tests: Vitest. Packages use a plain config; the app has `vitest.config.ts` (Nuxt runtime
  environment via `@nuxt/test-utils`, tests under `test/unit/`) and `vitest.e2e.config.ts`
  (plain config for `@nuxt/test-utils/e2e`, tests under `test/e2e/`).
- Git hooks (`lefthook.yml`): pre-commit formats and lints staged files, commit-msg runs
  commitlint (Conventional Commits), pre-push runs typecheck, knip and unit tests.

Dependencies use caret ranges (`^x.y.z`) on the versions verified in
`.scratch/house-cost-here-mvp/versions.md`; `packageManager` stays exact.

Fonts: the UI uses the system font stack on purpose. `@nuxt/fonts` was tried and removed because
a web font costs about 225 ms of simulated first paint and breaks the Lighthouse LCP budget; see
`.scratch/house-cost-here-mvp/versions.md`, Deviations.

## Deploying

The app runs on Vercel as one Nuxt project whose root is the repository root. `vercel.json` at the
root sets the framework preset (`nuxtjs`), the install command (`pnpm install --frozen-lockfile`)
and the build command (`pnpm --filter @house-cost/web build`); leave the Vercel Root Directory
setting empty. Vercel sets `VERCEL=1` while building, which makes Nitro pick its `vercel` preset,
and `apps/web/nuxt.config.ts` then writes the Build Output API directory to `.vercel/output` at
the repository root, where Vercel expects it. A plain `pnpm build` is unaffected and still writes
the Node server to `apps/web/.output`.

```sh
vercel deploy          # preview deployment, from the repository root
vercel deploy --prod   # production deployment
vercel build --prod    # build locally into .vercel/output without deploying
```

The first `vercel deploy` links the directory to a Vercel project (accept the repository root as
the code location). `vercel build` needs that link, or the project settings pulled with
`vercel pull`, and is what CI can run before `vercel deploy --prebuilt`.

Environment variables, all optional, set in the Vercel project for Production and Preview:

| Variable                                                    | Default                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `NUXT_USER_AGENT`                                           | `what-does-a-house-cost-here/<version> (+repository URL)`    |
| `NUXT_PUBLIC_MAP_STYLE_LIGHT`, `NUXT_PUBLIC_MAP_STYLE_DARK` | The VersaTiles `colorful` and `eclipse` styles               |
| `NUXT_DATA_PROVIDER`                                        | `open-data` in production builds, `fixture` in dev and tests |

The Data Provider default is decided at build time from `NODE_ENV`, which `nuxt build` sets to
`production`, so a deployment uses the open-data adapters (Overpass, Nominatim, HM Land Registry)
without any variable. Nominatim's usage policy wants a User-Agent that identifies the deployment
and its operator; override `NUXT_USER_AGENT` if the default does not name you.

The server function (`.vercel/output/functions/__fallback.func`) is configured through
`nitro.vercel.functions` in `nuxt.config.ts`: `maxDuration` 30 s, because cold Overpass-bound
routes take 2 to 5.5 s, and the `nodejs24.x` runtime to match `.nvmrc`.

Caching: the route handlers cache upstream results with Nitro's `defineCachedFunction`, whose
production storage is the in-memory driver. On Vercel that cache lives per function instance, so
a cold instance fetches everything again; there is no shared cache (no Vercel KV or Redis) in the
MVP. The `Cache-Control` headers on the `/api/*` responses (6 h for houses and facts, 24 h for
prices and geocode) let the Vercel CDN absorb repeats meanwhile.

The Vercel build container has no `.git` directory, so the root `prepare` script only runs
`lefthook install` when `git rev-parse` finds a repository.

To run a production build with the fixture provider locally (the generated town, no network):

```sh
pnpm build
NUXT_DATA_PROVIDER=fixture node apps/web/.output/server/index.mjs
```

`pnpm dev` already uses the fixture provider; `NUXT_DATA_PROVIDER=open-data pnpm dev` runs the
real adapters against the open-data services.
