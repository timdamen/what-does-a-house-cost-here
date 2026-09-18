# 15 Vercel deployment readiness

Status: done
Type: task
Blocked by: 11, 13

## Goal

The app deploys to Vercel from the repo root with the open-data provider active in production.

## Scope

- `vercel.json` at the root if needed (framework `nuxtjs`, `rootDirectory` cannot be set in the file so document `apps/web` as the Vercel project root in the README, or make a root-level build work by setting `buildCommand: pnpm --filter @house-cost/web build` and `outputDirectory: apps/web/.output`; pick what works with `vercel build` locally and document it).
- Nitro caching on Vercel: the default in-memory cache is per instance; keep it for the MVP but note it in the README. Do not add Vercel KV.
- Production defaults: `NUXT_DATA_PROVIDER` defaults to `open-data` when `NODE_ENV=production` and unset.
- `vercel build` succeeds locally (use `vercel build` without deploying).

## Acceptance

- `vercel build` succeeds locally; README has a "Deploying" section.

## Comments

- Done. Approach (a): one Vercel project rooted at the repository root. Root `vercel.json` sets `framework: "nuxtjs"`, `installCommand: "pnpm install --frozen-lockfile"` and `buildCommand: "pnpm --filter @house-cost/web build"`; no `outputDirectory` and no `functions` entry, because both are ignored once the build emits Build Output API v3 (`@vercel/static-build` returns the `.vercel/output` tree as soon as `config.json` exists there, before it looks at the output directory; the `functions` globs match source files under `api/`, not Nitro's generated `.func`).
- The catch with a root project: `@vercel/static-build` looks for `.vercel/output/config.json` in the directory of the entrypoint `package.json`, i.e. the repository root, while Nitro's `vercel` preset writes `{{ rootDir }}/.vercel/output`, i.e. `apps/web/.vercel/output`. `nuxt.config.ts` now sets `nitro.output.dir` to `<repo root>/.vercel/output` when `VERCEL` is set (the platform and `vercel build` both set it, and it is what makes Nitro autodetect the preset) or `NITRO_PRESET=vercel`; the preset's `serverDir`/`publicDir` follow through their `{{ output.dir }}` templates. A plain `pnpm build` still uses `node-server` into `apps/web/.output` (verified; `pnpm lighthouse` and the e2e builds are unchanged).
- Function settings via `nitro.vercel.functions` (spread into `.vc-config.json` by the preset): `maxDuration: 30`, `runtime: 'nodejs24.x'`. Nitro 2.13.4 caps its detected runtime at `nodejs22.x` (`SUPPORTED_NODE_VERSIONS = [18, 20, 22]`), so it was set explicitly; Vercel lists 24.x as its default Node version and `@vercel/build-utils` 13.8 knows the `nodejs24.x` runtime string.
- `NUXT_DATA_PROVIDER`: `runtimeConfig.dataProvider` was already `process.env.NODE_ENV === 'production' ? 'open-data' : 'fixture'`; `nuxt build` sets `NODE_ENV=production`, and the built function bundle carries `dataProvider: "open-data"` (grep of `chunks/nitro/nitro.mjs`). No change needed.
- Vercel's build container has no `.git` directory, and lefthook 2.1.14 `install` exits 1 without one regardless of `LEFTHOOK=0` or `CI` (tested in an empty directory), which would fail `pnpm install` through the root `prepare` script. `prepare` is now `if git rev-parse --git-dir >/dev/null 2>&1; then lefthook install; else echo ...; fi`; tested both branches.
- Local verification, without linking or creating a Vercel project: `vercel build --yes` on an unlinked directory runs `vercel pull --yes`, which links (and would create) a project, so it was not used. Instead a gitignored `.vercel/project.json` with placeholder `projectId`/`orgId` and `settings: { framework: "nuxtjs", rootDirectory: null, ... }` was written (the CLI's `build` reads it with `readProjectSettings` and makes no API call once `settings` exist), then from the repo root: `vercel build --prod`. Output: "Build Completed in .vercel/output [13s]"; it landed at `<repo root>/.vercel/output/` with `config.json` (version 3, immutable cache headers for `/_nuxt`, `/_fonts`, the API routes mapped to functions, `/(.*)` to `/__fallback`), `functions/__fallback.func/.vc-config.json` (`runtime nodejs24.x`, `maxDuration 30`, `launcherType Nodejs`, `supportsResponseStreaming true`), `functions/api/*.func`, `functions/index.func` and `functions/__nuxt_error.func` (symlinks to `__fallback`), and `static/_nuxt` with the `.br`/`.gz` siblings from `compressPublicAssets`. Nothing was written under `apps/web/.vercel`. The placeholder `.vercel/` directory was deleted afterwards so a later `vercel deploy` links properly.
- Kept: the in-memory Nitro cache (per function instance; no Vercel KV), documented in the README "Deploying" section together with the commands, the environment variables and the fixture-provider run.
