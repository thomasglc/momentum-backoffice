<script setup lang="ts">
defineProps<{
  items: { label: string; to?: string }[]
}>()
</script>

<template>
  <nav class="flex items-center gap-1.5 text-sm text-slate-500 mb-6">
    <template v-for="(item, i) in items" :key="i">
      <RouterLink v-if="item.to" :to="item.to" class="hover:text-slate-900 transition-colors">
        {{ item.label }}
      </RouterLink>
      <span v-else class="text-slate-900 font-medium">{{ item.label }}</span>
      <span v-if="i < items.length - 1" class="text-slate-300">/</span>
    </template>
  </nav>
</template>
