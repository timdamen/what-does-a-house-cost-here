<script setup lang="ts">
/**
 * Fixed-height panel shown where the map will be, server-rendered by `HouseMapFrame.vue` and
 * kept until MapLibre has loaded. Research decision 7: no indicator for the first second, then a
 * spinner (faded in with CSS so it works without JavaScript), a step indicator from 10 s, retry
 * on failure.
 */
withDefaults(
  defineProps<{
    summary: string;
    status?: 'loading' | 'error';
    /** Extra line under the spinner, e.g. "Loading map (2/3)". */
    detail?: string;
  }>(),
  { status: 'loading', detail: undefined },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    class="map-placeholder bg-muted text-muted absolute inset-0 flex flex-col items-center justify-start gap-3 px-4 pt-[20dvh] text-center"
    data-testid="map-placeholder"
  >
    <p class="text-sm">{{ summary }}</p>

    <template v-if="status === 'error'">
      <p class="text-highlighted text-base font-medium">Map failed to load</p>
      <UButton
        label="Retry"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="solid"
        class="min-h-12 min-w-12"
        @click="emit('retry')"
      />
    </template>

    <span v-else class="map-placeholder__spinner flex flex-col items-center gap-2" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-8 motion-safe:animate-spin" />
      <span class="sr-only">Loading map</span>
      <span v-if="detail" class="text-xs">{{ detail }}</span>
    </span>
  </div>
</template>

<style scoped>
.map-placeholder {
  background-image:
    linear-gradient(
      to right,
      color-mix(in srgb, currentColor 8%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      color-mix(in srgb, currentColor 8%, transparent) 1px,
      transparent 1px
    );
  background-size: 32px 32px;
}

@keyframes map-placeholder-appear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.map-placeholder__spinner {
  animation: map-placeholder-appear 0s linear 1s both;
}
</style>
