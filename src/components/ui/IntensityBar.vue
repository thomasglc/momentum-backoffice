<script setup lang="ts">
const props = defineProps<{ score: number }>()
</script>

<template>
  <div class="flex items-center gap-0.5">
    <div
      v-for="i in 10"
      :key="i"
      class="w-2 h-2 rounded-sm"
      :class="i <= props.score ? 'bg-indigo-500' : 'bg-slate-200'"
    />
    <span class="ml-1.5 text-xs text-slate-400">{{ props.score }}/10</span>
  </div>
</template>
