<script setup lang="ts">
const config = useRuntimeConfig();
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
    <h1 class="text-2xl font-semibold">What does a house cost here?</h1>
    <p class="text-muted">
      Open-data house prices for wherever you are standing. The map, list and neighbourhood facts
      arrive in later tickets.
    </p>
    <UButton icon="i-lucide-map-pin" label="Use my location" disabled />
    <p class="text-xs text-dimmed">Light map style: {{ config.public.mapStyleLight }}</p>
  </main>
</template>
