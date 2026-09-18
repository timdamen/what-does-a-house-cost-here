<script setup lang="ts">
/**
 * Shown when an upstream open-data service answered with an Upstream Error (HTTP 502). Never a
 * blank page (user story 41): one sentence that puts the blame where it belongs and a retry.
 */
withDefaults(
  defineProps<{
    /** Name of the failing service, for the small print. */
    service?: string;
    retrying?: boolean;
  }>(),
  { service: undefined, retrying: false },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div role="alert" data-testid="error-retry">
    <UAlert
      color="error"
      variant="soft"
      icon="i-lucide-cloud-off"
      title="Could not load this area"
      description="The open-data service is unavailable right now. It's them, not you."
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            label="Retry"
            icon="i-lucide-refresh-cw"
            color="error"
            variant="solid"
            class="min-h-12"
            :loading="retrying"
            @click="emit('retry')"
          />
          <span v-if="service" class="text-muted text-xs">Service: {{ service }}</span>
        </div>
      </template>
    </UAlert>
  </div>
</template>
