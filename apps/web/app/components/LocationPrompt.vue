<script setup lang="ts">
/**
 * Shown when the URL carries no Location. Requests the browser position as soon as it mounts
 * (user story 1) and falls back to place search on denial, absence or failure (stories 3, 4).
 */
const { status, locate } = useGeolocation();
const { setLocation } = useLocation();

const showSearch = computed(
  () => status.value === 'denied' || status.value === 'unsupported' || status.value === 'error',
);
const showButton = computed(() => status.value !== 'unsupported');

const sentence = computed(() => {
  switch (status.value) {
    case 'denied':
      return 'Location access was turned off, so search for a place instead.';
    case 'unsupported':
      return 'This browser cannot share your location, so search for a place instead.';
    case 'error':
      return 'We could not find your location; try again or search for a place.';
    case 'granted':
      return 'Found you. Loading houses nearby.';
    default:
      return 'Share your location to see what houses cost around you; only a rounded position goes in the page address.';
  }
});

onMounted(async () => {
  const found = await locate();
  if (found) await setLocation(found);
});
</script>

<template>
  <section aria-labelledby="location-prompt-heading" class="flex flex-col gap-4">
    <h2 id="location-prompt-heading" class="text-lg font-medium">Where are you?</h2>
    <p aria-live="polite" class="text-muted">{{ sentence }}</p>
    <LocateMeButton v-if="showButton" label="Use my location" block />
    <PlaceSearch v-if="showSearch" />
  </section>
</template>
