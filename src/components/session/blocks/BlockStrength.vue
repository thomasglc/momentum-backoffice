<script setup lang="ts">
import type { BlockStrength } from '@/types'

defineProps<{ block: BlockStrength }>()
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      <span>💪</span>
      <span>MUSCULATION</span>
      <span v-if="block.rest_sec" class="text-slate-400 font-normal normal-case">· repos {{ block.rest_sec }}s</span>
    </div>
    <div class="space-y-1.5">
      <div
        v-for="ex in block.exercises"
        :key="ex.id"
        class="flex items-center gap-3 text-sm"
      >
        <span class="flex-1 text-slate-700 font-medium">
          {{ ex.custom_label || ex.exercise_id.name }}
        </span>
        <span class="text-slate-500 tabular-nums">
          {{ ex.sets }}
          <span class="text-slate-300 mx-1">×</span>
          {{ ex.reps ?? `${ex.duration_sec}s` }}
        </span>
        <span v-if="ex.weight_kg" class="text-xs text-slate-400">{{ ex.weight_kg }} kg</span>
      </div>
    </div>
    <p v-if="block.note" class="text-xs text-slate-400 mt-2 italic">{{ block.note }}</p>
  </div>
</template>
