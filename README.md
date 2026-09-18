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
pnpm test:e2e         # placeholder until the e2e ticket lands
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

Exact versions are pinned; see `.scratch/house-cost-here-mvp/versions.md`.
