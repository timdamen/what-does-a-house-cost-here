<script setup lang="ts">
import type { Location } from '@house-cost/domain';

/**
 * "Use my location" control. Requests the browser position and writes the rounded Location to
 * the URL. Icon-only when no `label` is given (48 px square, for the map); with a label it is a
 * full-width primary button (for the prompt).
 */
const props = defineProps<{
  label?: string;
  block?: boolean;
}>();

const emit = defineEmits<{
  located: [location: Location];
  failed: [status: 'denied' | 'error' | 'unsupported'];
}>();

const { status, locate } = useGeolocation();
const { setLocation } = useLocation();

async function onClick() {
  const found = await locate();
  if (found) {
    await setLocation(found);
    emit('located', found);
  } else if (status.value !== 'requesting' && status.value !== 'idle') {
    emit('failed', status.value === 'granted' ? 'error' : status.value);
  }
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
