<script setup lang="ts">
import { useAthleteSchedule } from '@/composables/useAthleteSchedule'
import AthleteWeekBadge from './AthleteWeekBadge.vue'
import type { AthleteWithAssignment } from '@/types'

defineProps<{ athletes: AthleteWithAssignment[] }>()
const emit = defineEmits<{
  edit: [athlete: AthleteWithAssignment]
  delete: [athlete: AthleteWithAssignment]
}>()

const { daysUntilRace } = useAthleteSchedule()

function formatRaceDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date))
}

function planTitle(a: AthleteWithAssignment): string {
  const pid = a.assignment?.plan_id
  if (!pid) return '—'
  return typeof pid === 'object' ? pid.title : `Plan #${pid}`
}

function planId(a: AthleteWithAssignment): number | null {
  const pid = a.assignment?.plan_id
  if (!pid) return null
  return typeof pid === 'object' ? pid.id : pid
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200">
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Athlète</th>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date de course</th>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avancement</th>
          <th class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr
          v-for="athlete in athletes"
          :key="athlete.id"
          class="hover:bg-slate-50 transition-colors group"
        >
          <!-- Athlète -->
          <td class="px-4 py-3">
            <div class="font-medium text-slate-900">{{ athlete.name }}</div>
            <div v-if="athlete.email" class="text-xs text-slate-400">{{ athlete.email }}</div>
          </td>

          <!-- Plan -->
          <td class="px-4 py-3">
            <RouterLink
              v-if="planId(athlete)"
              :to="`/plans/${planId(athlete)}`"
              class="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
            >
              {{ planTitle(athlete) }}
            </RouterLink>
            <span v-else class="text-slate-400">—</span>
          </td>

          <!-- Date de course -->
          <td class="px-4 py-3 text-slate-600">
            <span v-if="athlete.assignment?.race_date">
              {{ formatRaceDate(athlete.assignment.race_date) }}
            </span>
            <span v-else class="text-slate-400">—</span>
          </td>

          <!-- Avancement -->
          <td class="px-4 py-3">
            <AthleteWeekBadge
              v-if="athlete.assignment?.race_date"
              :race-date="athlete.assignment.race_date"
            />
            <span v-else class="text-slate-400">—</span>
          </td>

          <!-- Actions -->
          <td class="px-4 py-3">
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click="emit('edit', athlete)"
                class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Modifier"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="emit('delete', athlete)"
                class="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                title="Supprimer"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        </tr>

        <!-- Empty state -->
        <tr v-if="athletes.length === 0">
          <td colspan="5" class="px-4 py-12 text-center text-sm text-slate-400">
            Aucun athlète — cliquez sur "Ajouter un athlète" pour commencer.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
