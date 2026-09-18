# 0005 Price Signals come from a registry of regional adapters keyed by country

Status: accepted (2026-09-17)

## Context

Open price registers are national or regional (HM Land Registry for England and Wales, Kadaster in the Netherlands, and so on) and each has its own interface and licence. There is no worldwide open source of sale prices, yet the app's name promises a price and must work anywhere (spec "Solution", "Further Notes"). The spec ("Data Provider port") asks for a registry of regional adapters, one real adapter in the MVP, and "no data" as a normal value.

Alternatives: one adapter with per-country branches inside it (grows into a tangle), a commercial price API (out of scope: non-open data), or shipping only the region that has data (breaks "works worldwide").

## Decision

- `PriceAdapter` in `@house-cost/open-data`: `{ countryCodes: string[]; getPriceSignals(houses); getPriceSummary(location, radius) }`.
- The Price Adapter Registry maps an ISO country code, taken from Nominatim reverse geocoding of the Location, to an adapter. An unknown code returns `priceSummary: null` and no Price Signals as a normal result with its own Provenance, never an `UpstreamError`.
- The MVP registers `GB` backed by HM Land Registry Price Paid Data through its linked-data API at `https://landregistry.data.gov.uk/`, matched by postcode where a House has one, with the summary built from the last 24 months for the area's postcodes.
- The fixture provider covers both paths: a fixture area with prices and a second area far away that returns `null`.
- Every further region is its own ticket: one adapter, its recorded fixtures, one registration line.

## Consequences

- "No open price data for this region yet" is a first-class UI state with its own card, not an empty number or an error (user story 36). The open-data provider and the One-Pager both treat `null` as expected.
- The country code decides the adapter, so a Search Area straddling a border uses the country of its centre. Acceptable for a 1000 m maximum radius.
- Match quality is regional. The research measured only 72 of 2,064 buildings in central Amsterdam carrying `addr:housenumber`, so adapters will often match by street or area rather than house; the `scope` field on a Price Signal (`house | street | area`) says how precise the match was.
- Price Signals are cached for a day, longer than Houses and Facts, because registers update slowly.
- Currency and locale formatting follow the same country code, so a region's prices always show in its own currency.
- The registry is a small, boring lookup on purpose: it must stay easy to add a region to without touching the provider or the UI.

## References

- Spec `.scratch/house-cost-here-mvp/spec.md`, "Data Provider port" (bullet 5), "Out of Scope", "Further Notes"; user stories 32, 36, 46.
- `.scratch/house-cost-here-mvp/issues/00-README.md`, "Real price adapter region"; tickets 03, 04 and 10.
- `docs/research/mobile-map-ux.md`, evidence "Radius" (address coverage measurement).
