<script setup lang="ts">
import { computed } from 'vue'
import type { PlanState } from '@/utils/planCalendar'

const props = defineProps<{
  state: PlanState | null   // null : pas de plan, ou plan sans calendrier
  totalWeeks: number
}>()

const badge = computed(() => {
  const state = props.state
  if (!state) return { label: 'Sans calendrier', classes: 'bg-slate-100 text-slate-500' }
  if (state.status === 'done') return { label: 'Terminé', classes: 'bg-emerald-50 text-emerald-700' }
  if (state.status === 'before') {
    const label = state.daysToStart === 1 ? 'Commence demain' : `Commence dans ${state.daysToStart} j`
    return { label, classes: 'bg-slate-100 text-slate-600' }
  }
  return { label: `S${state.weekNumber} / ${props.totalWeeks}`, classes: 'bg-indigo-50 text-indigo-700' }
})
</script>

<template>
  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tabular-nums whitespace-nowrap" :class="badge.classes">
    {{ badge.label }}
  </span>
</template>
