# 15 Vercel deployment readiness

Status: ready-for-agent
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
