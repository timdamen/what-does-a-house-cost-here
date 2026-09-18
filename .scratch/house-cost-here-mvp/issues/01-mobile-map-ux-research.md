# 01 Mobile map UX research

Status: done
Type: research
Blocked by: none

## Goal

Spec section "Implementation Decisions › Order of work" and user story 51. Use the `research` skill. Investigate primary sources (Apple HIG Maps, Material Design, MapLibre GL JS docs, Mapbox mobile guidance, published usability findings such as Nielsen Norman Group and Baymard) and save the findings as `docs/research/mobile-map-ux.md`.

## Must answer

1. Default Search Radius and the fixed set of radius options for a phone (the spec's placeholder is `[250, 500, 1000, 2000]` m, default 500).
2. Bottom sheet: confirm or change the three snap points (peek, half, full) and give heights as viewport fractions. When to switch to a side panel (breakpoint).
3. Map control size and placement for thumbs, away from browser chrome (minimum hit target, safe-area insets).
4. Marker design: price-labelled vs plain markers, clustering thresholds, label abbreviation of currency amounts.
5. Reduced-motion and dark-mode handling in MapLibre (what to disable, style switching).
6. Performance budget: exact Lighthouse thresholds (performance score, TTI/LCP/TBT on simulated 4G, mid-range phone) and initial JS budget in kB relative to MapLibre's size. Also confirm MapLibre GL JS with vector tiles from an open host (VersaTiles or OpenFreeMap) is the right default and which host offers light and dark styles without an API key.
7. Loading pattern: placeholder and progress while the map library loads lazily.

## Output

- `docs/research/mobile-map-ux.md` with a "Decisions" section at the top listing the concrete numbers and choices above, each with a citation, followed by the evidence.
- Any default the research overturns is listed under "Overturned defaults" so ticket 14 records it in an ADR.

## Acceptance

- File exists, every decision cites a primary source URL.
- Decisions section gives exact numbers for radius, snap points, budgets and tile host.

## Comments

- 2026-09-17: Findings in `docs/research/mobile-map-ux.md`. Five defaults overturned for ticket 14's ADRs: radius options drop 2000 m (Overpass counts measured at 18–28k buildings in cities, ~10 MB per query against a 1 GB/day policy); the bottom sheet hosts list + facts, not only the card (NN/g scroll-vs-pan finding); MapLibre's 29 px buttons go to 48 px; the budget is LCP ≤ 2.5 s + TBT ≤ 200 ms (TTI is unscored since Lighthouse 10); MapLibre is lazy-loaded with `import()` because 6.10.0 ships ESM only, so Nuxt Scripts is not needed for it.
- VersaTiles publishes no fair-use page; OpenFreeMap style URLs are recorded as the runtime-config fallback.
