# 14 Domain docs: CONTEXT.md and ADRs

Status: done
Type: task
Blocked by: 01

## Goal

Spec section "Domain docs"; user story 51. Use the `domain-modeling` skill conventions if it offers a format; otherwise the layout in `docs/agents/domain.md`.

## Scope

- `CONTEXT.md` at the repo root seeded from the spec glossary (Location, Search Area, House, Price Signal, Neighbourhood, Neighbourhood Facts, One-Pager, Data Provider), plus terms the tickets introduced (Geocoder, Provenance, Upstream Error, Price Adapter Registry), each with a one-line definition and the package that owns it.
- ADRs in `docs/adr/`: `0001-oxlint-over-nuxt-eslint.md`, `0002-maplibre-vector-tiles.md`, `0003-url-as-location-source-of-truth.md`, `0004-data-provider-port.md`, `0005-regional-price-adapter-registry.md`. Format: Status, Context, Decision, Consequences. Incorporate any "Overturned defaults" from `docs/research/mobile-map-ux.md`.

## Acceptance

- Files exist, reference the research note where relevant, and `pnpm quality` stays green (oxfmt may format Markdown; check).

## Comments

- Done. `CONTEXT.md` at the repo root (glossary with owning package per term and a "Naming rules" section) and `docs/adr/0001` to `0006`. ADR 0006 was added beyond the ticket list to record overturned default 2 from `docs/research/mobile-map-ux.md` (the bottom sheet hosts the list and facts), since it changes the spec's page structure; ADR 0002 folds in overturned defaults 1, 3 and 5 (radius options, control size, dynamic import instead of Nuxt Scripts). Each ADR uses Status, Context, Decision, Consequences, References and stays under 60 lines.
- `docs/**` is excluded from oxfmt and oxlint by `ignorePatterns` (ticket 02), so `CONTEXT.md` is the only new file the formatter sees; `pnpm quality` stays green.
