# 02 Monorepo scaffold and quality tooling

Status: ready-for-agent
Type: task
Blocked by: none

## Goal

User stories 47, 48, 49 and spec sections "Monorepo", "Nuxt and official modules", "Quality tooling". Produce an installable, buildable, green-quality monorepo with the three workspaces, all official Nuxt modules, and all hooks. No feature code.

## Scope

- Root: `package.json` (private, `packageManager: pnpm@10.32.1`, scripts `dev`, `build`, `quality`, `fmt`, `fmt:check`, `lint`, `typecheck`, `knip`, `test`, `test:e2e`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.nvmrc`, `.gitignore`, `.npmrc`, `tsconfig.base.json`, `.oxlintrc.json`, `.oxfmtrc.json` (or whatever the current oxfmt config file is called; check `npx oxfmt --help`), `knip.json`, `lefthook.yml`, `commitlint.config.js`, `.editorconfig`, `README.md` (short).
- `packages/domain` and `packages/open-data`: `package.json` with `exports`, `tsconfig.json` extending base, `src/index.ts` placeholder, a Vitest config, one trivial passing test each, `build` via `tsc` (emit to `dist/`) or ship TS source through `exports` pointing at `src` (choose the simpler that works with Nuxt and vue-tsc; document the choice in the README).
- `apps/web`: latest Nuxt 4 app in the Nuxt 4 `app/` directory layout with modules `@nuxt/ui`, `@nuxt/image`, `@nuxt/fonts`, `@nuxt/icon` (plus `@iconify-json/lucide`), `@nuxt/scripts`, `@nuxt/test-utils/module`; devtools enabled; `nuxt.config.ts` with the runtime config keys from `00-README.md`; `app/app.vue` rendering a placeholder page; `nuxt typecheck` passing; a Vitest config with a smoke test through `@nuxt/test-utils`; Nitro preset left default (Vercel is detected automatically at deploy time).
- Pin every dependency to the exact versions in `../versions.md`. If a pinned version proves incompatible (for example TypeScript 7 with vue-tsc), pick the newest version that works, verify it against the registry, and record the change in `../versions.md` with a one-line reason.
- lefthook: pre-commit runs `oxfmt` and `oxlint` on staged files; pre-push runs typecheck, knip and unit tests; commit-msg runs commitlint with `@commitlint/config-conventional`.
- CI: `.github/workflows/ci.yml` running `pnpm install --frozen-lockfile` and `pnpm quality` on Node 24 (a Lighthouse job is added by ticket 13).
- No `@nuxt/eslint`. Do not add ESLint.

## Acceptance

- `pnpm install`, `pnpm quality`, `pnpm --filter @house-cost/web build` all succeed from a clean checkout.
- `git commit` with a non-conventional message is rejected by lefthook; a conventional one passes.
- `../versions.md` updated with any deviations.
