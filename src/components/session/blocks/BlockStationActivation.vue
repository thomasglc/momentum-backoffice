<script setup lang="ts">
import type { BlockStationActivation } from '@/types'

defineProps<{ block: BlockStationActivation }>()
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      <span>⚙️</span>
      <span>ACTIVATION</span>
      <span v-if="block.rounds" class="text-slate-400 font-normal normal-case">· {{ block.rounds }} rounds</span>
    </div>
    <p v-if="block.note" class="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded mb-2 italic">{{ block.note }}</p>
    <div class="space-y-1.5">
      <div v-for="st in block.stations" :key="st.id" class="flex items-center gap-3 text-sm">
        <span class="flex-1 text-slate-700 font-medium">{{ st.custom_label || st.station_id.name }}</span>
        <span v-if="st.distance_m" class="text-slate-500 tabular-nums">{{ st.distance_m }} m</span>
        <span v-else-if="st.reps" class="text-slate-500 tabular-nums">{{ st.reps }} reps</span>
        <span v-else-if="st.duration_sec" class="text-slate-500 tabular-nums">{{ st.duration_sec }}s</span>
      </div>
    </div>
  </div>
</template>
