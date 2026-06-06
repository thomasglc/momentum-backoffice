<script setup lang="ts">
import type { BlockStationBlock } from '@/types'

defineProps<{ block: BlockStationBlock }>()

const formatLabel: Record<string, string> = {
  standard: 'Standard',
  pyramid: 'Pyramide',
  follow_the_leader: 'Follow the Leader',
}
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      <span>🧱</span>
      <span>BRICK</span>
      <span class="text-indigo-500 font-medium normal-case">· {{ formatLabel[block.brick_format] }}</span>
    </div>
    <p v-if="block.format_note" class="text-xs text-slate-500 italic mb-2">{{ block.format_note }}</p>
    <div class="space-y-1.5">
      <div v-for="st in block.stations" :key="st.id" class="flex items-center gap-3 text-sm">
        <span class="flex-1 text-slate-700 font-medium">{{ st.custom_label || st.station_id.name }}</span>
        <span v-if="st.distance_m" class="text-slate-500 tabular-nums">{{ st.distance_m }} m</span>
        <span v-else-if="st.reps" class="text-slate-500 tabular-nums">{{ st.reps }} reps</span>
        <span v-else-if="st.duration_sec" class="text-slate-500 tabular-nums">{{ st.duration_sec }}s</span>
        <span v-if="st.weight_kg_female || st.weight_kg_male" class="text-xs flex gap-1">
          <span v-if="st.weight_kg_female" class="text-pink-500">F {{ st.weight_kg_female }} kg</span>
          <span v-if="st.weight_kg_male" class="text-blue-500">H {{ st.weight_kg_male }} kg</span>
        </span>
      </div>
    </div>
  </div>
</template>
