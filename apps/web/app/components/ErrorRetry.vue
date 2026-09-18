<script setup lang="ts">
/**
 * Shown whenever loading the area failed, whatever the cause: an Upstream Error from an open-data
 * service (HTTP 502, with the service named), a server error or a lost connection. Never a blank
 * page (user story 41): one sentence and a retry.
 */
const props = withDefaults(
  defineProps<{
    /** Name of the failing upstream service, when the failure was a typed Upstream Error. */
    service?: string;
    retrying?: boolean;
  }>(),
  { service: undefined, retrying: false },
);

const emit = defineEmits<{ retry: [] }>();

const description = computed(() =>
  props.service
    ? "The open-data service is unavailable right now. It's them, not you."
    : 'Loading this area failed. Check your connection and try again.',
);
</script>

<template>
  <div role="alert" data-testid="error-retry">
    <UAlert
      color="error"
      variant="soft"
      icon="i-lucide-cloud-off"
      title="Could not load this area"
      :description="description"
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
