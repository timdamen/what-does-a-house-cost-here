# 0001 oxlint and oxfmt instead of Nuxt ESLint

Status: accepted (2026-09-17)

## Context

The spec ("Nuxt and official modules") restricts framework tooling to official Nuxt-org modules and names one deliberate exception: Nuxt ESLint is not used because the project owner chose oxlint. The "Quality tooling" section fixes the rest of the chain: oxfmt for formatting, `nuxt typecheck` and `tsc` for types, knip for dead code, all run by lefthook. Ticket 02 scaffolded this and confirmed it green.

The obvious alternative was `@nuxt/eslint`, which ships a generated flat config with Nuxt- and Vue-aware rules and is what most Nuxt 4 starters install.

## Decision

- oxlint is the only linter. Root `.oxlintrc.json` enables the `typescript`, `unicorn`, `oxc`, `import`, `promise`, `vitest` and `vue` plugins with `correctness` as errors and `suspicious` and `perf` as warnings.
- oxfmt is the only formatter, configured in `.oxfmtrc.json`. It also formats Markdown, JSON and YAML that it is given.
- No ESLint package is installed anywhere in the workspace; `@nuxt/eslint` is not added.
- lefthook runs `oxfmt --check` and `oxlint` on staged files at pre-commit; `pnpm quality` runs the same at the root. `.scratch/**` and `docs/**` are excluded from both.

## Consequences

- Lint and format runs are effectively instant, so they can sit on every commit without a lint-staged style setup.
- Nuxt-specific ESLint rules (auto-import awareness, `nuxt/*` rules) are not available. Nuxt conventions are enforced by `nuxt typecheck` (vue-tsc) and oxlint's `vue` plugin instead. If a rule only ESLint offers becomes necessary, the answer is a typecheck or a test, not a second linter.
- Contributors need the oxc editor extension rather than the ESLint one.
- This is the one place the "official modules only" rule is broken, so the exception is recorded here rather than left to be "fixed" by adding `@nuxt/eslint` later.

## References

- Spec `.scratch/house-cost-here-mvp/spec.md`, sections "Nuxt and official modules" and "Quality tooling"; user story 48.
- Ticket 02 `.scratch/house-cost-here-mvp/issues/02-monorepo-scaffold-and-tooling.md`, Comments.
