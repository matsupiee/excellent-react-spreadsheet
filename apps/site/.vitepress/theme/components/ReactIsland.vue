<script setup lang="ts">
import { createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

type DynamicImport = () => Promise<{ default: ComponentType }>;

const props = defineProps<{ component: DynamicImport }>();

const host = ref<HTMLDivElement | null>(null);
const root = shallowRef<Root | null>(null);

onMounted(async () => {
  if (host.value === null) return;
  const mod = await props.component();
  root.value = createRoot(host.value);
  root.value.render(createElement(mod.default));
});

onBeforeUnmount(() => {
  root.value?.unmount();
  root.value = null;
});
</script>

<template>
  <div ref="host" class="react-island" />
</template>

<style scoped>
.react-island {
  min-height: 120px;
}
</style>
