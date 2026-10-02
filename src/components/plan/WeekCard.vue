<script setup lang="ts">
import { computed } from 'vue'
import type { Week } from '@/types'

const props = defineProps<{
  week: Week
  planId: number
  busy?: boolean   // une copie est en cours : pas d'autre duplication pendant ce temps
}>()

const emit = defineEmits<{ duplicate: [week: Week] }>()

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
  <!-- Le bouton de duplication est posé sur la carte, hors du lien qui ouvre la semaine -->
  <div class="relative group">
    <RouterLink
      :to="`/plans/${planId}/weeks/${week.id}`"
      class="block h-full bg-white border rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
      :class="week.is_deload ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'"
    >
      <!-- pr-7 : la place du bouton de duplication, pour qu'il ne recouvre pas le badge « Décharge » -->
      <div class="flex items-start justify-between gap-2 mb-2 pr-7">
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

    <button
      type="button"
      :disabled="busy"
      class="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-slate-400 hover:bg-slate-100 hover:text-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:hidden"
      :title="`Dupliquer la semaine ${week.week_number} en fin de plan`"
      @click="emit('duplicate', week)"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
      </svg>
    </button>
  </div>
</template>
