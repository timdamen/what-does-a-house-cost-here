<script setup lang="ts">
/**
 * Entry page. Without a Location in the URL it shows the prompt; with one it shows a placeholder
 * panel that ticket 08 replaces with the One-Pager (map, list, facts).
 */
const { location, radius } = useLocation();
</script>

<template>
  <main
    class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]"
  >
    <h1 class="text-2xl font-semibold">What does a house cost here?</h1>

    <LocationPrompt v-if="!location" />

    <UCard v-else title="Location set">
      <div class="flex flex-col gap-4">
        <p class="text-muted">
          Showing {{ location.lat }}, {{ location.lng }} within {{ radius }} m. The map, house list
          and neighbourhood facts arrive in later tickets.
        </p>
        <PlaceSearch />
        <LocateMeButton label="Use my location" block />
      </div>
    </UCard>
  </main>
</template>
