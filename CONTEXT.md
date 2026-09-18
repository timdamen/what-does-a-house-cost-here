# What Does a House Cost Here?

A single-page, mobile-first web app that answers one question for the place you are standing in or thinking about: what does a house cost here, and what is it like to live here? Everything comes from open data and degrades honestly where a region has none.

This file is the glossary and nothing else. Each term names the package that owns it: `domain` (`@house-cost/domain`, `packages/domain`), `open-data` (`@house-cost/open-data`, `packages/open-data`) or `web` (`@house-cost/web`, `apps/web`). Decisions live in `docs/adr/`.

## Language

### Place and area

- **Location** (`domain`): the single geographic point the app is currently centred on, as a rounded latitude and longitude. It comes from device geolocation or a place search, and the URL is its source of truth (ADR-0003).
- **Search Area** (`domain`): the circle around the Location, with a Search Radius, within which Houses and Neighbourhood Facts are gathered.
- **Search Radius** (`domain`): the radius of the Search Area in metres, chosen from a fixed set of options rather than a free slider (ADR-0002).
- **Neighbourhood** (`domain`): the named area the Location falls in, as reverse geocoding reports it, with its place hierarchy (suburb, city, region, country).

### Homes and prices

- **House** (`domain`): a residential building known to OpenStreetMap inside the Search Area, with whatever address and building type OSM holds for it.
- **Price Signal** (`domain`): a sale price or official valuation for a House, or for the street or area it sits in, from an open price register. Price Signals are regional and are often absent.
- **Price Summary** (`domain`): the typical, low and high price for a Neighbourhood with the date it holds for and the number of months of sales it covers; `null` means "no open price data for this region yet", which is a normal state, not an error.
- **Neighbourhood Facts** (`domain`): what the app shows for a Search Area: the Neighbourhood's name and hierarchy, the Price Summary, its Amenities with walking distances, and its Housing Mix.
- **Amenity** (`domain`): a school, supermarket, healthcare place, park or public transport stop near the Location, with its walking distance.
- **Housing Mix** (`domain`): counts of Houses in the Search Area by building type.

### Data sources

- **Data Provider** (`domain` port; implementations in `domain` and `open-data`): the single port through which the app reaches any external source of Houses, Price Signals or Neighbourhood Facts (ADR-0004). The fixture provider is the deterministic offline implementation; the open-data provider is the real one. A Price Signal lookup takes a House reference (`HouseRef`: id, Location and address), the part of a House a register keys on.
- **Geocoder** (`domain` port; implementations in `domain` and `open-data`): the port behind the place-search box, turning a typed query into candidate Locations with a label and country code.
- **Provenance** (`domain`): the source name and fetched-at time attached to every Data Provider result and shown to the visitor under "About this data".
- **Upstream Error** (`domain`): the typed error a Data Provider raises when an open-data service fails; the server turns it into an HTTP 502 and the One-Pager into a retry message.
- **Price Adapter** (`open-data`): the implementation of one region's open price register, returning Price Signals and a Price Summary.
- **Price Adapter Registry** (`open-data`): the lookup from ISO country code to Price Adapter; a region without an adapter yields "no data" as a normal value (ADR-0005).

### The page

- **One-Pager** (`web`): the single page holding the map, the house list and the Neighbourhood Facts. It is the whole app.
- **Bottom Sheet** (`web`): the draggable panel over the map with three snap points (peek, half, full) that hosts the House Card, the house list and the Neighbourhood Facts; at 840px and wider it becomes a side panel (ADR-0006).
- **House Card** (`web`): the compact view of the selected House shown at the top of the Bottom Sheet.
- **Search Here** (`web`): the control that appears after the map is dragged away from the Location and moves the Location to the map centre.

## Naming rules

- Use the terms above, with this capitalisation in prose, in code, tests, tickets and UI copy. Identifiers use the same words (`searchArea`, `priceSignal`, `neighbourhoodFacts`).
- A House is a building from OpenStreetMap. Avoid "property", "listing", "home", "dwelling" and "real estate": nothing here is for sale.
- A Price Signal is one open-register datum; the Price Summary is the aggregate. Avoid a bare "price", "valuation", "estimate" or "asking price".
- An Amenity is an Amenity. Avoid "POI", "place of interest" and "point".
- Location is the centre point. "Position" is reserved for the device's own geolocation dot; avoid "coordinates" and "geo" as nouns.
- Search Area and Search Radius. Avoid "bounds", "viewport", "range" and "distance" for the circle.
- Data Provider for the port; the pieces behind it (Overpass, Nominatim, price registers) are adapters. Avoid "data source", "backend", "API client" and "service".
- Bottom Sheet on phones, side panel at 840px and wider. Avoid "drawer", "modal" and "panel" for the phone form.
- Neighbourhood keeps its British spelling everywhere, identifiers included.
