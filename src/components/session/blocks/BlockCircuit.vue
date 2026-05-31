<script setup lang="ts">
import type { BlockCircuit } from '@/types'

defineProps<{ block: BlockCircuit }>()
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      <span>🔄</span>
      <span>{{ block.label ?? 'CIRCUIT' }}</span>
      <span v-if="block.format === 'emom'" class="text-indigo-600 font-semibold">EMOM</span>
      <span v-if="block.format === 'amrap'" class="text-orange-600 font-semibold">AMRAP</span>
      <span v-if="block.rounds" class="text-slate-400 font-normal normal-case">· {{ block.rounds }} rounds</span>
      <span v-if="block.duration_min" class="text-slate-400 font-normal normal-case">· {{ block.duration_min }} min</span>
      <span v-if="block.rest_between_min" class="text-slate-400 font-normal normal-case">· repos {{ block.rest_between_min }} min</span>
    </div>
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
    <p v-if="block.note" class="text-xs text-slate-400 mt-2 italic">{{ block.note }}</p>
  </div>
</template>
