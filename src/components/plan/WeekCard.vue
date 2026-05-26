<script setup lang="ts">
import { computed } from 'vue'
import type { Week } from '@/types'

const props = defineProps<{ week: Week; planId: number }>()

const totalDuration = computed(() =>
  props.week.sessions.reduce((acc, s) => acc + (s.duration_min ?? 0), 0)
)

const avgIntensity = computed(() => {
  const scored = props.week.sessions.filter((s) => s.intensity_score != null)
  if (!scored.length) return 0
  return Math.round(scored.reduce((acc, s) => acc + (s.intensity_score ?? 0), 0) / scored.length)
})
</script>

<template>
  <RouterLink
    :to="`/plans/${planId}/weeks/${week.id}`"
    class="block bg-white border rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
    :class="week.is_deload ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'"
  >
    <div class="flex items-start justify-between gap-2 mb-2">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">S{{ week.week_number }}</span>
          <span class="text-xs text-slate-400">Phase {{ week.phase }}</span>
          <span
            v-if="week.is_deload"
            class="text-xs font-medium px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded"
          >
            Décharge
          </span>
        </div>
        <p v-if="week.theme" class="text-sm font-medium text-slate-700 mt-0.5">{{ week.theme }}</p>
      </div>
    </div>

    <div class="flex items-center gap-3 text-xs text-slate-400 mb-2">
      <span>{{ week.sessions.length }} séances</span>
      <span v-if="totalDuration">{{ totalDuration }} min</span>
    </div>

    <div class="flex gap-0.5">
      <div
        v-for="i in 10"
        :key="i"
        class="h-1 flex-1 rounded-sm"
        :class="i <= avgIntensity ? (week.is_deload ? 'bg-emerald-400' : 'bg-indigo-400') : 'bg-slate-100'"
      />
    </div>
  </RouterLink>
</template>
