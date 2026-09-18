<script setup lang="ts">
/**
 * "Use my location" control. Requests the browser position and writes the rounded Location to
 * the URL; the shared geolocation status drives its loading state and the prompt's wording.
 * Icon-only when no `label` is given (48 px square, for the header); with a label it is a
 * full-width primary button (for the prompt).
 */
const props = defineProps<{
  label?: string;
  block?: boolean;
}>();

const { status, locate } = useGeolocation();
const { setLocation } = useLocation();

async function onClick() {
  const found = await locate();
  if (found) await setLocation(found);
}
</script>

<template>
  <UButton
    type="button"
    icon="i-lucide-locate-fixed"
    size="xl"
    :label="props.label"
    :square="!props.label"
    :block="props.block"
    :loading="status === 'requesting'"
    :aria-label="props.label ?? 'Use my location'"
    :ui="{ base: 'min-h-12 min-w-12 justify-center' }"
    @click="onClick"
  />
</template>
