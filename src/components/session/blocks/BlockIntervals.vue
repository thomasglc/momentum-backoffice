<script setup lang="ts">
import type { BlockIntervals } from '@/types'
import PaceZoneBadge from '@/components/ui/PaceZoneBadge.vue'

defineProps<{ block: BlockIntervals }>()
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
      <span>⏱</span>
      <span>INTERVALLES</span>
      <span v-if="block.sets" class="text-slate-600">· {{ block.sets }}×</span>
      <span v-if="block.distance_km" class="text-slate-400 font-normal normal-case">{{ block.distance_km }} km</span>
      <span v-if="block.duration_min" class="text-slate-400 font-normal normal-case">{{ block.duration_min }} min</span>
      <PaceZoneBadge v-if="block.pace_zone" :zone="block.pace_zone" />
      <span v-if="block.recovery_min" class="text-slate-400 font-normal normal-case">· récup {{ block.recovery_min }} min</span>
    </div>
    <p v-if="block.note" class="text-xs text-slate-400 mt-2 italic">{{ block.note }}</p>
  </div>
</template>
