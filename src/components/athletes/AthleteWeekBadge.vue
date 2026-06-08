<script setup lang="ts">
import { computed } from 'vue'
import { useAthleteSchedule } from '@/composables/useAthleteSchedule'

const props = defineProps<{ raceDate: string }>()

const { currentWeek, daysUntilRace, isValid } = useAthleteSchedule()

const week = computed(() => currentWeek(props.raceDate))
const days = computed(() => daysUntilRace(props.raceDate))
const valid = computed(() => isValid(props.raceDate))

const status = computed(() => {
  if (week.value < 1) return 'not-started'
  if (week.value > 19) return 'done'
  return 'active'
})
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Semaine courante -->
    <span
      v-if="status === 'active'"
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      :class="valid ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'"
    >
      S{{ week }} / 19
    </span>
    <span
      v-else-if="status === 'not-started'"
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500"
    >
      Pas encore démarré
    </span>
    <span
      v-else
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700"
    >
      Terminé
    </span>

    <!-- Jours restants -->
    <span v-if="days > 0" class="text-xs text-slate-400">{{ days }}j</span>

    <!-- Alerte minimum -->
    <span
      v-if="!valid && status === 'active'"
      class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600"
      title="Moins de 12 semaines — préparation insuffisante"
    >
      ⚠ &lt;12 sem.
    </span>
  </div>
</template>
