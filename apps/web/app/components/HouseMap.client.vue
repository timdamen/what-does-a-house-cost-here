<script setup lang="ts">
import type { Location } from '@house-cost/domain';
import {
  boundingBox,
  haversineMetres,
  localeForCountryCode,
  roundLocation,
} from '@house-cost/domain';
import type {
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
  toPosition,
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
  selectedFilter,
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
import { searchAreaSummary } from '../utils/map/summary';
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
 * server-side placeholder and the CSS variables this component positions its controls with.
 * The placeholder itself belongs to the frame: it is server-rendered once and must survive
 * hydration untouched, otherwise Chrome drops it as a largest-contentful-paint candidate and
 * Lighthouse attributes the LCP to the re-created copy after the map chunk (ticket 13). This
 * component only reports `placeholder` state upward and exposes `retry()`.
 */
defineOptions({ name: 'HouseMap' });

const props = withDefaults(defineProps<HouseMapProps>(), {
  selectedHouseId: null,
  userPosition: null,
  amenityFocus: null,
  countryCode: undefined,
  peekHeight: '15dvh',
  testHook: false,
});

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
const WIDE_SCREEN_QUERY = '(min-width: 840px)';
const LOAD_STEPS = 3;

const config = useRuntimeConfig();
const colorMode = useColorMode();
const toast = useToast();

const canvasHost = useTemplateRef<HTMLDivElement>('canvasHost');
const insets = useTemplateRef<HTMLDivElement>('insets');

const status = ref<HouseMapStatus>('loading');
const showSteps = ref(false);
const loadStep = ref(0);
const busy = ref(false);
const searchHereVisible = ref(false);
const locating = ref(false);
const failure = ref<string | undefined>(undefined);

let map: MapLibreMap | undefined;
let styleLoaded = false;
let reducedMotion = false;
let timers: number[] = [];

const theme = computed<MapTheme>(() => (colorMode.value === 'dark' ? 'dark' : 'light'));
const styleUrl = computed(() =>
  theme.value === 'dark' ? config.public.mapStyleDark : config.public.mapStyleLight,
);
const locale = computed(() => localeForCountryCode(props.countryCode));
const summary = computed(() =>
  searchAreaSummary(props.centre, props.radiusMetres, props.houses.length),
);
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
  void init();
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
  const created = new maplibre.Map({
    container,
    style: styleUrl.value,
    center: toPosition(props.centre),
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
  map = created;

  created.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-left');
  if (window.matchMedia(WIDE_SCREEN_QUERY).matches) {
    created.addControl(new maplibre.NavigationControl({ visualizePitch: false }), 'top-right');
  }

  created.on('error', (event) => {
    if (!styleLoaded) fail(event.error);
  });
  created.on('styleimagemissing', ({ id }) => addPillImage(created, id));
  created.on('style.load', () => {
    styleLoaded = true;
    loadStep.value = LOAD_STEPS;
  });
  created.once('load', () => onLoad(created));
  created.on('moveend', () => onMoveEnd(created));
  created.on('click', (event) => onTap(created, event));
  created.on('dataloading', () => (busy.value = true));
  created.on('idle', () => (busy.value = false));
}

function onLoad(created: MapLibreMap): void {
  const fonts = pickTextFonts(created.getStyle());
  for (const id of Object.values(IMAGE_IDS)) addPillImage(created, id);

  created.addSource(
    SOURCE_IDS.houses,
    houseSourceSpec(houseFeatureCollection(props.houses, locale.value)),
  );
  created.addSource(SOURCE_IDS.searchArea, plainSourceSpec(currentArea()));
  created.addSource(SOURCE_IDS.userPosition, plainSourceSpec(pointCollection(props.userPosition)));
  created.addSource(SOURCE_IDS.amenityFocus, plainSourceSpec(pointCollection(props.amenityFocus)));
  for (const layer of layersFor(fonts)) created.addLayer(layer);

  for (const layerId of TAPPABLE_LAYERS) {
    created.on('mouseenter', layerId, () => (created.getCanvas().style.cursor = 'pointer'));
    created.on('mouseleave', layerId, () => (created.getCanvas().style.cursor = ''));
  }

  clearTimers();
  status.value = 'ready';
  fitToArea(false);
}

function layersFor(fonts: TextFonts, forTheme: MapTheme = theme.value) {
  return appLayers(paletteFor(forTheme), fonts, props.selectedHouseId ?? null);
}

function addPillImage(created: MapLibreMap, id: string): void {
  const style = pillStyleForImage(id);
  if (!style || created.hasImage(id)) return;
  created.addImage(id, createPillImage(style), PILL_IMAGE_OPTIONS);
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

/** Pixel insets of the area not covered by the sheet's peek or the page header. */
function visibleInsets(): { top: number; bottom: number; left: number; right: number } {
  const host = canvasHost.value;
  const box = insets.value;
  if (!host || !box) return { top: 0, bottom: 0, left: 0, right: 0 };
  const hostRect = host.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  return {
    top: Math.max(0, boxRect.top - hostRect.top),
    bottom: Math.max(0, hostRect.bottom - boxRect.bottom),
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

function visibleCentre(created: MapLibreMap): Location {
  const host = canvasHost.value;
  if (!host) return created.getCenter();
  const { top, bottom } = visibleInsets();
  const point: PointLike = [host.clientWidth / 2, (top + (host.clientHeight - bottom)) / 2];
  const { lat, lng } = created.unproject(point);
  return { lat, lng };
}

function fitToArea(animate: boolean): void {
  const host = canvasHost.value;
  if (!map || !host || host.clientHeight === 0 || host.clientWidth === 0) return;
  const box = boundingBox({ centre: props.centre, radiusMetres: props.radiusMetres });
  map.fitBounds(
    [
      [box.west, box.south],
      [box.east, box.north],
    ],
    { padding: cameraPadding(), duration: animate ? duration() : 0, maxZoom: MAX_FIT_ZOOM },
  );
}

function onMoveEnd(created: MapLibreMap): void {
  if (status.value !== 'ready') return;
  const distance = haversineMetres(props.centre, visibleCentre(created));
  searchHereVisible.value = shouldOfferSearchHere(distance, props.radiusMetres);
}

function onTap(created: MapLibreMap, event: MapMouseEvent): void {
  if (status.value !== 'ready') return;
  const half = HIT_BOX_PX / 2;
  const { x, y } = event.point;
  const features = created.queryRenderedFeatures(
    [
      [x - half, y - half],
      [x + half, y + half],
    ],
    { layers: TAPPABLE_LAYERS },
  );
  const hit = nearestFeature(created, features, event.point);
  if (!hit) {
    if (props.selectedHouseId) emit('select', null);
    return;
  }
  if ('cluster' in hit.properties) {
    void expandCluster(created, hit);
    return;
  }
  emit('select', String(hit.properties.id));
}

function nearestFeature(
  created: MapLibreMap,
  features: MapGeoJSONFeature[],
  point: MapMouseEvent['point'],
): MapGeoJSONFeature | undefined {
  let best: MapGeoJSONFeature | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const projected = created.project(feature.geometry.coordinates as [number, number]);
    const distance = projected.dist(point);
    if (distance < bestDistance) {
      best = feature;
      bestDistance = distance;
    }
  }
  return best;
}

async function expandCluster(created: MapLibreMap, cluster: MapGeoJSONFeature): Promise<void> {
  const source = created.getSource<GeoJSONSource>(SOURCE_IDS.houses);
  if (!source || cluster.geometry.type !== 'Point') return;
  const zoom = await source.getClusterExpansionZoom(cluster.properties.cluster_id as number);
  created.easeTo({
    center: cluster.geometry.coordinates as [number, number],
    zoom,
    duration: duration(),
    offset: cameraOffset(),
  });
}

function applySelection(selectedId: string | null): void {
  if (!map || status.value !== 'ready') return;
  map.setFilter(LAYER_IDS.housePlain, houseFilter(false, selectedId));
  map.setFilter(LAYER_IDS.housePriced, houseFilter(true, selectedId));
  map.setFilter(LAYER_IDS.selectedPlain, selectedFilter(false, selectedId));
  map.setFilter(LAYER_IDS.selectedPriced, selectedFilter(true, selectedId));
}

function isInsideVisibleArea(location: Location): boolean {
  const host = canvasHost.value;
  if (!map || !host) return true;
  const { top, bottom } = visibleInsets();
  const point = map.project(toPosition(location));
  return (
    point.x >= CAMERA_MARGIN_PX &&
    point.x <= host.clientWidth - CAMERA_MARGIN_PX &&
    point.y >= top + CAMERA_MARGIN_PX &&
    point.y <= host.clientHeight - bottom - CAMERA_MARGIN_PX
  );
}

function revealLocation(location: Location): void {
  if (!map || status.value !== 'ready' || isInsideVisibleArea(location)) return;
  map.easeTo({ center: toPosition(location), duration: duration(), offset: cameraOffset() });
}

/** Whether the House is drawn on its own; inside a cluster the source has no feature for it. */
function isUnclustered(houseId: string): boolean {
  if (!map) return true;
  const features = map.querySourceFeatures(SOURCE_IDS.houses, {
    filter: ['==', ['get', 'id'], houseId],
  });
  return features.length > 0;
}

/** Shows the selected House: pans when it is off-screen, zooms in when a cluster hides it. */
function revealHouse(house: MapHouse): void {
  if (!map || status.value !== 'ready') return;
  if (isUnclustered(house.id)) {
    revealLocation(house.location);
    return;
  }
  map.easeTo({
    center: toPosition(house.location),
    zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM + 1),
    duration: duration(),
    offset: cameraOffset(),
  });
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
  if (!map) return;
  searchHereVisible.value = false;
  emit('search-here', roundLocation(visibleCentre(map)));
}

function locate(): void {
  if (!('geolocation' in navigator)) {
    toast.add({
      title: 'Location unavailable',
      description: 'This browser cannot share your position. Search for a place instead.',
      color: 'warning',
    });
    return;
  }
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false;
      emit(
        'search-here',
        roundLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      );
    },
    () => {
      locating.value = false;
      toast.add({
        title: 'Location unavailable',
        description: 'Allow location access or search for a place instead.',
        color: 'warning',
      });
    },
    { enableHighAccuracy: true, timeout: 10_000 },
  );
}

function getState(): HouseMapState {
  return {
    status: status.value,
    centre: roundLocation(map ? visibleCentre(map) : props.centre),
    zoom: map?.getZoom() ?? zoomForRadius(props.radiusMetres),
    radiusMetres: props.radiusMetres,
    houseCount: props.houses.length,
    selectedHouseId: props.selectedHouseId ?? null,
    searchHereVisible: searchHereVisible.value,
    theme: theme.value,
  };
}

function installTestHook(): void {
  if (!(import.meta.dev || props.testHook)) return;
  window.__houseMap = {
    select: (houseId) => emit('select', houseId),
    getState,
  };
}

watch(
  () => [props.houses, locale.value] as const,
  ([houses, currentLocale]) =>
    setSourceData(SOURCE_IDS.houses, houseFeatureCollection(houses, currentLocale)),
);

watch(
  () => props.selectedHouseId ?? null,
  (selectedId) => {
    applySelection(selectedId);
    const house = selectedId ? props.houses.find((entry) => entry.id === selectedId) : undefined;
    if (house) revealHouse(house);
  },
);

watch(
  () => [props.centre.lat, props.centre.lng, props.radiusMetres],
  () => {
    setSourceData(SOURCE_IDS.searchArea, currentArea());
    searchHereVisible.value = false;
    fitToArea(true);
  },
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

    <div ref="insets" class="house-map__insets pointer-events-none absolute inset-x-0">
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
        <slot name="locate" :locate="locate" :locating="locating">
          <UButton
            icon="i-lucide-locate"
            color="neutral"
            variant="solid"
            square
            aria-label="Use my location"
            class="pointer-events-auto size-12 shadow-lg"
            :loading="locating"
            data-testid="locate-me"
            @click="locate"
          />
        </slot>
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
.house-map__insets {
  top: var(--house-map-top-inset, 16px);
  bottom: var(--house-map-bottom-inset, 16px);
  /* Above the frame's placeholder, so the controls stay usable while the map loads. */
  z-index: 1;
}

/* Research decision 3: MapLibre's 29 px buttons become 48 px thumb targets. */
.house-map .maplibregl-ctrl-group button {
  width: 48px;
  height: 48px;
}

.house-map .maplibregl-ctrl-top-right {
  top: var(--house-map-top-inset, 16px);
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
