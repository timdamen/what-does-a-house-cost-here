import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSourceSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

import type { PillStyle } from './pill';

/** GeoJSON source ids the map adds on top of the base style. */
export const SOURCE_IDS = {
  houses: 'house-cost-houses',
  searchArea: 'house-cost-search-area',
  userPosition: 'house-cost-user-position',
  amenityFocus: 'house-cost-amenity-focus',
} as const;

export const LAYER_IDS = {
  areaFill: 'house-cost-area-fill',
  areaLine: 'house-cost-area-line',
  clusters: 'house-cost-clusters',
  clusterCount: 'house-cost-cluster-count',
  housePlain: 'house-cost-house-plain',
  housePriced: 'house-cost-house-priced',
  selectedPlain: 'house-cost-selected-plain',
  selectedPriced: 'house-cost-selected-priced',
  amenityFocus: 'house-cost-amenity-focus',
  userHalo: 'house-cost-user-halo',
  userDot: 'house-cost-user-dot',
} as const;

export const IMAGE_IDS = {
  pillLight: 'house-cost-pill-light',
  pillDark: 'house-cost-pill-dark',
  pillSelected: 'house-cost-pill-selected',
} as const;

export type MapTheme = 'light' | 'dark';

/** Research decision 4: 48 px thumb target + 8 px gap so two visible markers never overlap. */
const CLUSTER_RADIUS = 56;
/** Clusters are shown up to z16; individual Houses from z17. */
export const CLUSTER_MAX_ZOOM = 16;
/** Tap hit-test box in CSS px. */
export const HIT_BOX_PX = 48;
const CLUSTER_CIRCLE_RADIUS = 20;

export interface MapPalette {
  primary: string;
  onPrimary: string;
  surface: string;
  onSurface: string;
  selected: string;
  onSelected: string;
  area: string;
  user: string;
  amenity: string;
  pill: PillStyle;
  pillSelected: PillStyle;
  pillImage: string;
}

export const LIGHT_PALETTE: MapPalette = {
  primary: '#0f766e',
  onPrimary: '#ffffff',
  surface: '#ffffff',
  onSurface: '#134e4a',
  selected: '#c2410c',
  onSelected: '#ffffff',
  area: '#0f766e',
  user: '#2563eb',
  amenity: '#d97706',
  pill: { fill: '#ffffff', stroke: '#0f766e' },
  pillSelected: { fill: '#c2410c', stroke: '#ffffff' },
  pillImage: IMAGE_IDS.pillLight,
};

const DARK_PALETTE: MapPalette = {
  primary: '#2dd4bf',
  onPrimary: '#042f2e',
  surface: '#0f172a',
  onSurface: '#ccfbf1',
  selected: '#fb923c',
  onSelected: '#431407',
  area: '#2dd4bf',
  user: '#60a5fa',
  amenity: '#fbbf24',
  pill: { fill: '#0f172a', stroke: '#2dd4bf' },
  pillSelected: { fill: '#fb923c', stroke: '#0f172a' },
  pillImage: IMAGE_IDS.pillDark,
};

export function paletteFor(theme: MapTheme): MapPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

/** Pill style for an image id, or `undefined` when the id is not one of ours. */
export function pillStyleForImage(imageId: string): PillStyle | undefined {
  switch (imageId) {
    case IMAGE_IDS.pillLight:
      return LIGHT_PALETTE.pill;
    case IMAGE_IDS.pillDark:
      return DARK_PALETTE.pill;
    case IMAGE_IDS.pillSelected:
      return LIGHT_PALETTE.pillSelected;
    default:
      return undefined;
  }
}

/** GeoJSON as MapLibre's source accepts it, without needing the `@types/geojson` global namespace. */
export type GeoJsonData = Exclude<GeoJSONSourceSpecification['data'], string>;

export function houseSourceSpec(data: GeoJsonData): GeoJSONSourceSpecification {
  return {
    type: 'geojson',
    data,
    cluster: true,
    clusterRadius: CLUSTER_RADIUS,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
  };
}

export function plainSourceSpec(data: GeoJsonData): GeoJSONSourceSpecification {
  return { type: 'geojson', data };
}

const NOT_CLUSTER: ExpressionSpecification = ['!', ['has', 'point_count']];
const IS_CLUSTER: ExpressionSpecification = ['has', 'point_count'];

/** Unclustered Houses that are not the selected one, split by whether they carry a price. */
export function houseFilter(hasPrice: boolean, selectedId: string | null): FilterSpecification {
  const price: ExpressionSpecification = hasPrice
    ? ['==', ['get', 'hasPrice'], true]
    : ['!=', ['get', 'hasPrice'], true];
  return ['all', NOT_CLUSTER, price, ['!=', ['get', 'id'], selectedId ?? '']];
}

/** The selected House only (never matches while nothing is selected). */
export function selectedFilter(hasPrice: boolean, selectedId: string | null): FilterSpecification {
  const price: ExpressionSpecification = hasPrice
    ? ['==', ['get', 'hasPrice'], true]
    : ['!=', ['get', 'hasPrice'], true];
  return ['all', NOT_CLUSTER, price, ['==', ['get', 'id'], selectedId ?? '']];
}

/** Layers a tap may hit, in the order `queryRenderedFeatures` is asked for them. */
export const TAPPABLE_LAYERS: string[] = [
  LAYER_IDS.selectedPriced,
  LAYER_IDS.selectedPlain,
  LAYER_IDS.housePriced,
  LAYER_IDS.housePlain,
  LAYER_IDS.clusters,
];

export interface TextFonts {
  regular: string[];
  bold: string[];
}

const FALLBACK_FONTS: TextFonts = { regular: ['Noto Sans Regular'], bold: ['Noto Sans Bold'] };

/**
 * Font stacks that exist at the style's glyph endpoint. VersaTiles names them `noto_sans_bold`,
 * OpenFreeMap `Noto Sans Bold`; reading them from the loaded style keeps the labels host-agnostic.
 */
export function pickTextFonts(style: StyleSpecification | undefined): TextFonts {
  const stacks: string[][] = [];
  for (const layer of style?.layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const font = layer.layout?.['text-font'];
    if (Array.isArray(font) && font.every((name) => typeof name === 'string')) {
      stacks.push(font as string[]);
    }
  }
  if (stacks.length === 0) return FALLBACK_FONTS;
  const bold = stacks.find((stack) => stack.some((name) => /bold/i.test(name)));
  const regular = stacks.find((stack) => stack.some((name) => /regular/i.test(name)));
  return {
    regular: regular ?? stacks[0] ?? FALLBACK_FONTS.regular,
    bold: bold ?? regular ?? stacks[0] ?? FALLBACK_FONTS.bold,
  };
}

/** All app layers in draw order (Search Area at the bottom, user position on top). */
export function appLayers(
  palette: MapPalette,
  fonts: TextFonts,
  selectedId: string | null,
): LayerSpecification[] {
  return [
    {
      id: LAYER_IDS.areaFill,
      type: 'fill',
      source: SOURCE_IDS.searchArea,
      paint: { 'fill-color': palette.area, 'fill-opacity': 0.08 },
    },
    {
      id: LAYER_IDS.areaLine,
      type: 'line',
      source: SOURCE_IDS.searchArea,
      paint: { 'line-color': palette.area, 'line-width': 2, 'line-opacity': 0.7 },
    },
    {
      id: LAYER_IDS.clusters,
      type: 'circle',
      source: SOURCE_IDS.houses,
      filter: IS_CLUSTER,
      paint: {
        'circle-color': palette.primary,
        'circle-radius': CLUSTER_CIRCLE_RADIUS,
        'circle-stroke-width': 2,
        'circle-stroke-color': palette.surface,
      },
    },
    {
      id: LAYER_IDS.clusterCount,
      type: 'symbol',
      source: SOURCE_IDS.houses,
      filter: IS_CLUSTER,
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': fonts.bold,
        'text-size': 14,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': palette.onPrimary },
    },
    {
      id: LAYER_IDS.housePlain,
      type: 'circle',
      source: SOURCE_IDS.houses,
      filter: houseFilter(false, selectedId),
      paint: {
        'circle-color': palette.surface,
        'circle-radius': 7,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': palette.primary,
      },
    },
    {
      id: LAYER_IDS.housePriced,
      type: 'symbol',
      source: SOURCE_IDS.houses,
      filter: houseFilter(true, selectedId),
      layout: {
        'icon-image': palette.pillImage,
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [3, 8, 3, 8],
        'text-field': ['get', 'label'],
        'text-font': fonts.bold,
        'text-size': 12,
        'text-padding': 2,
        'symbol-sort-key': 1,
      },
      paint: { 'text-color': palette.onSurface },
    },
    {
      id: LAYER_IDS.selectedPlain,
      type: 'circle',
      source: SOURCE_IDS.houses,
      filter: selectedFilter(false, selectedId),
      paint: {
        'circle-color': palette.selected,
        'circle-radius': 11,
        'circle-stroke-width': 3,
        'circle-stroke-color': palette.surface,
      },
    },
    {
      id: LAYER_IDS.selectedPriced,
      type: 'symbol',
      source: SOURCE_IDS.houses,
      filter: selectedFilter(true, selectedId),
      layout: {
        'icon-image': IMAGE_IDS.pillSelected,
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [5, 10, 5, 10],
        'icon-allow-overlap': true,
        'text-field': ['get', 'label'],
        'text-font': fonts.bold,
        'text-size': 14,
        'text-allow-overlap': true,
        'symbol-sort-key': 0,
      },
      paint: { 'text-color': palette.onSelected },
    },
    {
      id: LAYER_IDS.amenityFocus,
      type: 'circle',
      source: SOURCE_IDS.amenityFocus,
      paint: {
        'circle-color': palette.amenity,
        'circle-radius': 9,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': palette.surface,
      },
    },
    {
      id: LAYER_IDS.userHalo,
      type: 'circle',
      source: SOURCE_IDS.userPosition,
      paint: { 'circle-color': palette.user, 'circle-radius': 18, 'circle-opacity': 0.25 },
    },
    {
      id: LAYER_IDS.userDot,
      type: 'circle',
      source: SOURCE_IDS.userPosition,
      paint: {
        'circle-color': palette.user,
        'circle-radius': 7,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    },
  ];
}

const APP_SOURCE_IDS = new Set<string>(Object.values(SOURCE_IDS));

/**
 * `transformStyle` for `map.setStyle`: keeps our sources (with their current data) and rebuilds
 * our layers for the new theme so a light/dark switch never drops the markers.
 */
export function carryAppStyle(
  previous: StyleSpecification | undefined,
  next: StyleSpecification,
  layers: LayerSpecification[],
): StyleSpecification {
  const sources = { ...next.sources };
  for (const [id, source] of Object.entries(previous?.sources ?? {})) {
    if (APP_SOURCE_IDS.has(id)) sources[id] = source;
  }
  return { ...next, sources, layers: [...next.layers, ...layers] };
}
