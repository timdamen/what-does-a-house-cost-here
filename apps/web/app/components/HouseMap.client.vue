<script setup lang="ts">
import type { Location } from '@house-cost/domain';
import {
  boundingBox,
  haversineMetres,
  localeForCountryCode,
  roundLocation,
} from '@house-cost/domain';
import type {
  EaseToOptions,
  GeoJSONSource,
  Map as MapLibreMap,
  MapGeoJSONFeature,
  MapMouseEvent,
  PointLike,
} from 'maplibre-gl';

import {
  circlePolygon,
  houseFeatureCollection,
  pointCollection,
  toLngLat,
} from '../utils/map/geojson';
import {
  appLayers,
  carryAppStyle,
  CLUSTER_MAX_ZOOM,
  type GeoJsonData,
  HIT_BOX_PX,
  houseFilter,
  houseSourceSpec,
  IMAGE_IDS,
  LAYER_IDS,
  paletteFor,
  pickTextFonts,
  pillStyleForImage,
  plainSourceSpec,
  SOURCE_IDS,
  TAPPABLE_LAYERS,
  type MapTheme,
  type TextFonts,
} from '../utils/map/layers';
import { createPillImage, PILL_IMAGE_OPTIONS } from '../utils/map/pill';
import {
  RADIUS_OPTIONS,
  radiusLabel,
  shouldOfferSearchHere,
  zoomForRadius,
} from '../utils/map/radius';
import type {
  HouseMapProps,
  HouseMapState,
  HouseMapStatus,
  MapHouse,
  MapPlaceholderState,
} from '../utils/map/types';

/**
 * The MapLibre map. Client-only: `maplibre-gl` and its CSS are imported in `onMounted` so they
 * never enter the entry bundle. Mount it through `HouseMapFrame.vue`, which renders the
 * server-side placeholder, resolves the prop defaults and sets the CSS variables this component
 * positions its controls and camera with. The placeholder itself belongs to the frame: it is
 * server-rendered once and must survive hydration untouched, otherwise Chrome drops it as a
 * largest-contentful-paint candidate and Lighthouse attributes the LCP to the re-created copy
 * after the map chunk (ticket 13). This component only reports `placeholder` state upward and
 * exposes `retry()`.
 */
defineOptions({ name: 'HouseMap' });

const props = defineProps<HouseMapProps>();

const emit = defineEmits<{
  select: [houseId: string | null];
  'search-here': [centre: Location];
  'radius-change': [metres: number];
  /** Loading or error state for the frame's placeholder; `null` once the map is ready. */
  placeholder: [state: MapPlaceholderState | null];
}>();

type MapLibreModule = typeof import('maplibre-gl');

const STEPS_AFTER_MS = 10_000;
const CAMERA_DURATION_MS = 300;
const CAMERA_MARGIN_PX = 16;
const MAX_FIT_ZOOM = 17;
const LOAD_STEPS = 3;

const config = useRuntimeConfig();
const colorMode = useColorMode();
const painted = useAfterFirstPaint();

const canvasHost = useTemplateRef<HTMLDivElement>('canvasHost');
/** Invisible box covering the part of the canvas the sheet and header leave visible. */
const cameraFrame = useTemplateRef<HTMLDivElement>('cameraFrame');

const status = ref<HouseMapStatus>('loading');
const showSteps = ref(false);
const loadStep = ref(0);
const busy = ref(false);
const searchHereVisible = ref(false);
const failure = ref<string | undefined>(undefined);

let map: MapLibreMap | undefined;
let styleLoaded = false;
let reducedMotion = false;
let timers: number[] = [];
/**
 * Camera moves the app made itself and whose `moveend` has not fired yet. "Search here" only
 * follows the visitor's own drags, so those `moveend`s are swallowed.
 */
let pendingCameraMoves = 0;

const theme = computed<MapTheme>(() => (colorMode.value === 'dark' ? 'dark' : 'light'));
const styleUrl = computed(() =>
  theme.value === 'dark' ? config.public.mapStyleDark : config.public.mapStyleLight,
);
const locale = computed(() => localeForCountryCode(props.countryCode));
const placeholderStatus = computed(() => (status.value === 'error' ? 'error' : 'loading'));
const detail = computed(() => {
  if (status.value === 'error') return failure.value;
  return showSteps.value ? `Loading map (${loadStep.value}/${LOAD_STEPS})` : undefined;
});

watchEffect(() => {
  emit(
    'placeholder',
    status.value === 'ready' ? null : { status: placeholderStatus.value, detail: detail.value },
  );
});

defineExpose({ retry: init });

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  installTestHook();
  // The map chunk is the largest request on the page; it starts once the shell has painted.
  const stop = watch(
    painted,
    (isPainted) => {
      if (!isPainted) return;
      void init();
      nextTick(() => stop());
    },
    { immediate: true },
  );
});

onBeforeUnmount(() => {
  teardown();
  if (window.__houseMap?.getState === getState) delete window.__houseMap;
});

async function init(): Promise<void> {
  teardown();
  status.value = 'loading';
  failure.value = undefined;
  showSteps.value = false;
  loadStep.value = 1;
  timers.push(window.setTimeout(() => (showSteps.value = true), STEPS_AFTER_MS));

  try {
    const [maplibre, worker] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]);
    if (!canvasHost.value) return;
    loadStep.value = 2;
    // MapLibre spawns its worker from `new URL('maplibre-gl-worker.mjs', import.meta.url)`, a
    // file (plus the shared chunk it imports) that the production build never emits, so the map
    // would sit on "loading" forever. `?worker&url` makes Vite bundle the worker as its own
    // entry and hands back the URL it is served from, in dev and in the build.
    maplibre.setWorkerUrl(worker.default);
    createMap(maplibre, canvasHost.value);
  } catch (error) {
    fail(error);
  }
}

function createMap(maplibre: MapLibreModule, container: HTMLElement): void {
  map = new maplibre.Map({
    container,
    style: styleUrl.value,
    center: toLngLat(props.centre),
    zoom: zoomForRadius(props.radiusMetres),
    attributionControl: false,
    fadeDuration: reducedMotion ? 0 : CAMERA_DURATION_MS,
    touchPitch: false,
    pitchWithRotate: false,
    dragRotate: false,
    maxPitch: 0,
    cooperativeGestures: false,
    validateStyle: import.meta.dev,
  });

  map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-left');
  // Zoom buttons for mouse and keyboard users. The stylesheet below shows them from the
  // side-panel breakpoint only; on phones pinch does the job (research decision 3).
  map.addControl(new maplibre.NavigationControl({ visualizePitch: false }), 'top-right');

  map.on('error', (event) => {
    if (!styleLoaded) fail(event.error);
  });
  map.on('styleimagemissing', ({ id }) => addPillImage(id));
  map.on('style.load', () => {
    styleLoaded = true;
    loadStep.value = LOAD_STEPS;
  });
  map.once('load', onLoad);
  map.on('moveend', onMoveEnd);
  map.on('click', onTap);
  map.on('dataloading', () => (busy.value = true));
  map.on('idle', () => (busy.value = false));
}

function onLoad(): void {
  if (!map) return;
  const fonts = pickTextFonts(map.getStyle());
  for (const id of Object.values(IMAGE_IDS)) addPillImage(id);

  map.addSource(
    SOURCE_IDS.houses,
    houseSourceSpec(houseFeatureCollection(props.houses, locale.value)),
  );
  map.addSource(SOURCE_IDS.searchArea, plainSourceSpec(currentArea()));
  map.addSource(SOURCE_IDS.userPosition, plainSourceSpec(pointCollection(props.userPosition)));
  map.addSource(SOURCE_IDS.amenityFocus, plainSourceSpec(pointCollection(props.amenityFocus)));
  for (const layer of layersFor(fonts)) map.addLayer(layer);

  for (const layerId of TAPPABLE_LAYERS) {
    map.on('mouseenter', layerId, () => {
      if (map) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      if (map) map.getCanvas().style.cursor = '';
    });
  }

  clearTimers();
  status.value = 'ready';
  fitToArea(false);
}

function layersFor(fonts: TextFonts, forTheme: MapTheme = theme.value) {
  return appLayers(paletteFor(forTheme), fonts, props.selectedHouseId ?? null);
}

function addPillImage(id: string): void {
  const style = pillStyleForImage(id);
  if (!map || !style || map.hasImage(id)) return;
  map.addImage(id, createPillImage(style), PILL_IMAGE_OPTIONS);
}

function fail(error: unknown): void {
  clearTimers();
  failure.value = error instanceof Error ? error.message : String(error);
  status.value = 'error';
}

function teardown(): void {
  clearTimers();
  styleLoaded = false;
  busy.value = false;
  searchHereVisible.value = false;
  pendingCameraMoves = 0;
  map?.remove();
  map = undefined;
}

function clearTimers(): void {
  for (const timer of timers) window.clearTimeout(timer);
  timers = [];
}

function duration(): number {
  return reducedMotion ? 0 : CAMERA_DURATION_MS;
}

function currentArea() {
  return circlePolygon(props.centre, props.radiusMetres);
}

function setSourceData(sourceId: string, data: GeoJsonData): void {
  if (!map || status.value !== 'ready') return;
  void map.getSource<GeoJSONSource>(sourceId)?.setData(data);
}

/** Pixel insets of the canvas area not covered by the sheet (at its current height) or the header. */
function visibleInsets(): { top: number; bottom: number; left: number; right: number } {
  const host = canvasHost.value;
  const frame = cameraFrame.value;
  if (!host || !frame) return { top: 0, bottom: 0, left: 0, right: 0 };
  const hostRect = host.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  return {
    top: Math.max(0, frameRect.top - hostRect.top),
    bottom: Math.max(0, hostRect.bottom - frameRect.bottom),
    left: 0,
    right: 0,
  };
}

function cameraPadding() {
  const host = canvasHost.value;
  const { top, bottom } = visibleInsets();
  const height = host?.clientHeight ?? 0;
  const width = host?.clientWidth ?? 0;
  const vertical = Math.min(height / 2 - 1, Math.max(0, top + CAMERA_MARGIN_PX));
  const verticalBottom = Math.min(height / 2 - 1, Math.max(0, bottom + CAMERA_MARGIN_PX));
  const horizontal = Math.min(width / 2 - 1, CAMERA_MARGIN_PX);
  return { top: vertical, bottom: verticalBottom, left: horizontal, right: horizontal };
}

/** `easeTo` offset that centres a point in the visible area rather than the whole canvas. */
function cameraOffset(): [number, number] {
  const { top, bottom } = visibleInsets();
  return [0, (top - bottom) / 2];
}

/** The Location at the centre of the visible area, or `undefined` before the map exists. */
function visibleCentre(): Location | undefined {
  const host = canvasHost.value;
  if (!map) return undefined;
  if (!host) return map.getCenter();
  const { top, bottom } = visibleInsets();
  const point: PointLike = [host.clientWidth / 2, (top + (host.clientHeight - bottom)) / 2];
  const { lat, lng } = map.unproject(point);
  return { lat, lng };
}

/** A camera move the app makes itself; its `moveend` must not offer "Search here". */
function moveCamera(options: EaseToOptions): void {
  if (!map) return;
  pendingCameraMoves += 1;
  map.easeTo({ duration: duration(), offset: cameraOffset(), ...options });
}

function fitToArea(animate: boolean): void {
  const host = canvasHost.value;
  if (!map || !host || host.clientHeight === 0 || host.clientWidth === 0) return;
  const box = boundingBox({ centre: props.centre, radiusMetres: props.radiusMetres });
  pendingCameraMoves += 1;
  map.fitBounds(
    [
      [box.west, box.south],
      [box.east, box.north],
    ],
    { padding: cameraPadding(), duration: animate ? duration() : 0, maxZoom: MAX_FIT_ZOOM },
  );
}

function onMoveEnd(): void {
  if (pendingCameraMoves > 0) {
    pendingCameraMoves -= 1;
    searchHereVisible.value = false;
    return;
  }
  const centre = visibleCentre();
  if (status.value !== 'ready' || !centre) return;
  const distance = haversineMetres(props.centre, centre);
  searchHereVisible.value = shouldOfferSearchHere(distance, props.radiusMetres);
}

function onTap(event: MapMouseEvent): void {
  if (!map || status.value !== 'ready') return;
  const half = HIT_BOX_PX / 2;
  const { x, y } = event.point;
  const features = map.queryRenderedFeatures(
    [
      [x - half, y - half],
      [x + half, y + half],
    ],
    { layers: TAPPABLE_LAYERS },
  );
  const hit = nearestFeature(features, event.point);
  if (!hit) {
    if (props.selectedHouseId) emit('select', null);
    return;
  }
  if ('cluster' in hit.properties) {
    void expandCluster(hit);
    return;
  }
  emit('select', String(hit.properties.id));
}

function nearestFeature(
  features: MapGeoJSONFeature[],
  point: MapMouseEvent['point'],
): MapGeoJSONFeature | undefined {
  if (!map) return undefined;
  let best: MapGeoJSONFeature | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const projected = map.project(feature.geometry.coordinates as [number, number]);
    const distance = projected.dist(point);
    if (distance < bestDistance) {
      best = feature;
      bestDistance = distance;
    }
  }
  return best;
}

async function expandCluster(cluster: MapGeoJSONFeature): Promise<void> {
  const source = map?.getSource<GeoJSONSource>(SOURCE_IDS.houses);
  if (!source || cluster.geometry.type !== 'Point') return;
  const zoom = await source.getClusterExpansionZoom(cluster.properties.cluster_id as number);
  moveCamera({ center: cluster.geometry.coordinates as [number, number], zoom });
}

function applySelection(selectedId: string | null): void {
  if (!map || status.value !== 'ready') return;
  map.setFilter(LAYER_IDS.housePlain, houseFilter(false, 'others', selectedId));
  map.setFilter(LAYER_IDS.housePriced, houseFilter(true, 'others', selectedId));
  map.setFilter(LAYER_IDS.selectedPlain, houseFilter(false, 'selected', selectedId));
  map.setFilter(LAYER_IDS.selectedPriced, houseFilter(true, 'selected', selectedId));
}

function isInsideVisibleArea(location: Location): boolean {
  const host = canvasHost.value;
  if (!map || !host) return true;
  const { top, bottom } = visibleInsets();
  const point = map.project(toLngLat(location));
  return (
    point.x >= CAMERA_MARGIN_PX &&
    point.x <= host.clientWidth - CAMERA_MARGIN_PX &&
    point.y >= top + CAMERA_MARGIN_PX &&
    point.y <= host.clientHeight - bottom - CAMERA_MARGIN_PX
  );
}

/** Pans a Location into the visible area when it is outside it. */
function revealLocation(location: Location): void {
  if (!map || status.value !== 'ready' || isInsideVisibleArea(location)) return;
  moveCamera({ center: toLngLat(location) });
}

/** Whether the House is drawn on its own; inside a cluster the source has no feature for it. */
function isUnclustered(houseId: string): boolean {
  if (!map) return true;
  const features = map.querySourceFeatures(SOURCE_IDS.houses, {
    filter: ['==', ['get', 'id'], houseId],
  });
  return features.length > 0;
}

/**
 * Shows a House. `'centre'` always eases the camera onto it (a list selection, user story 26);
 * `'reveal'` only moves when it is hidden, under the sheet or inside a cluster (a map selection).
 * Either way a clustered House means zooming in until it stands alone.
 */
function showHouse(house: MapHouse, mode: 'centre' | 'reveal'): void {
  if (!map || status.value !== 'ready') return;
  const currentZoom = map.getZoom();
  const zoom = isUnclustered(house.id) ? currentZoom : Math.max(currentZoom, CLUSTER_MAX_ZOOM + 1);
  const hidden = zoom !== currentZoom || !isInsideVisibleArea(house.location);
  if (mode === 'reveal' && !hidden) return;
  moveCamera({ center: toLngLat(house.location), zoom });
}

function switchTheme(): void {
  if (!map || status.value !== 'ready') return;
  const nextTheme = theme.value;
  styleLoaded = false;
  map.setStyle(styleUrl.value, {
    transformStyle: (previous, next) =>
      carryAppStyle(previous, next, layersFor(pickTextFonts(next), nextTheme)),
  });
}

function searchHere(): void {
  const centre = visibleCentre();
  if (!centre) return;
  searchHereVisible.value = false;
  emit('search-here', roundLocation(centre));
}

function getState(): HouseMapState {
  return {
    status: status.value,
    centre: roundLocation(visibleCentre() ?? props.centre),
    zoom: map?.getZoom() ?? zoomForRadius(props.radiusMetres),
    radiusMetres: props.radiusMetres,
    houseCount: props.houses.length,
    selectedHouseId: props.selectedHouseId ?? null,
    searchHereVisible: searchHereVisible.value,
    theme: theme.value,
  };
}

/** Only in dev builds or with `public.testHooks` (env `NUXT_PUBLIC_TEST_HOOKS=true`). */
function installTestHook(): void {
  if (!(import.meta.dev || props.testHook)) return;
  window.__houseMap = {
    select: (houseId) => emit('select', houseId),
    getState,
  };
}

function houseById(houseId: string): MapHouse | undefined {
  return props.houses.find((house) => house.id === houseId);
}

watch(
  () => [props.houses, locale.value] as const,
  ([houses, currentLocale]) =>
    setSourceData(SOURCE_IDS.houses, houseFeatureCollection(houses, currentLocale)),
);

// The camera watchers run after the DOM update so the sheet's new height (a selection opens it)
// is already in the camera frame they measure.
watch(
  () => props.selectedHouseId ?? null,
  (selectedId) => {
    applySelection(selectedId);
    // A list selection is centred by the `centreOn` watcher below; do not also reveal it.
    if (!selectedId || props.centreOn?.houseId === selectedId) return;
    const house = houseById(selectedId);
    if (house) showHouse(house, 'reveal');
  },
  { flush: 'post' },
);

watch(
  () => props.centreOn,
  (request) => {
    const house = request ? houseById(request.houseId) : undefined;
    if (house) showHouse(house, 'centre');
  },
  { flush: 'post' },
);

watch(
  () => [props.centre.lat, props.centre.lng, props.radiusMetres],
  () => {
    setSourceData(SOURCE_IDS.searchArea, currentArea());
    searchHereVisible.value = false;
    fitToArea(true);
  },
  { flush: 'post' },
);

watch(
  () => props.userPosition,
  (position) => setSourceData(SOURCE_IDS.userPosition, pointCollection(position)),
);

watch(
  () => props.amenityFocus,
  (focus) => {
    setSourceData(SOURCE_IDS.amenityFocus, pointCollection(focus));
    if (focus) revealLocation(focus);
  },
  { flush: 'post' },
);

watch(theme, switchTheme);
</script>

<template>
  <div class="house-map absolute inset-0" data-testid="house-map" :data-status="status">
    <div
      ref="canvasHost"
      class="house-map__canvas size-full"
      role="application"
      aria-label="Map of houses around the search location"
    />

    <div
      ref="cameraFrame"
      class="house-map__camera-frame pointer-events-none invisible absolute inset-x-0"
      aria-hidden="true"
    />

    <div class="house-map__insets pointer-events-none absolute inset-x-0">
      <div class="absolute top-0 left-1/2 -translate-x-1/2">
        <UButton
          v-if="status === 'ready' && searchHereVisible"
          label="Search here"
          icon="i-lucide-search"
          color="neutral"
          variant="solid"
          class="pointer-events-auto min-h-12 rounded-full px-5 shadow-lg"
          data-testid="search-here"
          @click="searchHere"
        />
      </div>

      <div class="absolute right-4 bottom-0 flex flex-col items-end gap-2">
        <UIcon
          v-if="status === 'ready' && busy"
          name="i-lucide-loader-circle"
          class="text-muted size-6 motion-safe:animate-spin"
          aria-hidden="true"
        />
        <UFieldGroup
          class="pointer-events-auto shadow-lg"
          role="group"
          aria-label="Search radius"
          data-testid="radius-control"
        >
          <UButton
            v-for="option in RADIUS_OPTIONS"
            :key="option"
            :label="radiusLabel(option)"
            color="neutral"
            :variant="option === radiusMetres ? 'solid' : 'subtle'"
            :aria-pressed="option === radiusMetres"
            class="min-h-12 min-w-12 px-3"
            @click="emit('radius-change', option)"
          />
        </UFieldGroup>
      </div>
    </div>
  </div>
</template>

<style>
@reference '../assets/css/main.css';

.house-map__insets {
  top: var(--house-map-top-inset, 16px);
  bottom: var(--house-map-bottom-inset, 16px);
  /* Above the frame's placeholder, so the controls stay usable while the map loads. */
  z-index: 1;
}

.house-map__camera-frame {
  top: var(--house-map-top-inset, 16px);
  bottom: var(--house-map-camera-inset, var(--house-map-bottom-inset, 16px));
}

/* Research decision 3: MapLibre's 29 px buttons become 48 px thumb targets. */
.house-map .maplibregl-ctrl-group button {
  width: 48px;
  height: 48px;
}

.house-map .maplibregl-ctrl-top-right {
  top: var(--house-map-top-inset, 16px);
  /* Zoom buttons are for mouse and keyboard users: shown beside the side panel only. */
  display: none;
}

@media (width >= --theme(--breakpoint-panel)) {
  .house-map .maplibregl-ctrl-top-right {
    display: block;
  }
}

.house-map .maplibregl-ctrl-bottom-left {
  bottom: var(--house-map-bottom-inset, 16px);
  /* Leave the right edge to the control stack (three radius buttons plus gutters). */
  max-width: calc(100% - 232px);
}

.house-map .maplibregl-ctrl-bottom-left .maplibregl-ctrl {
  margin: 0 0 0 16px;
}
</style>
