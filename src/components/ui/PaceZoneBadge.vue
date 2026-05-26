<script setup lang="ts">
import type { PaceZone } from '@/types'

const props = defineProps<{ zone: PaceZone }>()

const zoneClasses: Record<PaceZone, string> = {
  Z1: 'bg-green-100 text-green-700',
  Z2: 'bg-emerald-100 text-emerald-700',
  Z3: 'bg-yellow-100 text-yellow-700',
  Z4: 'bg-orange-100 text-orange-700',
  Z5: 'bg-red-100 text-red-700',
  threshold: 'bg-purple-100 text-purple-700',
  race: 'bg-rose-100 text-rose-700',
}
</script>

<template>
  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold" :class="zoneClasses[props.zone]">
    {{ props.zone }}
  </span>
</template>
