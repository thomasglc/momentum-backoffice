<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTrackingStore } from '@/stores/tracking'
import type { TrackingRow } from '@/stores/tracking'
import { relativeDay } from '@/utils/tracking'
import WeekDots from '@/components/tracking/WeekDots.vue'
import PlanStateBadge from '@/components/tracking/PlanStateBadge.vue'

const store = useTrackingStore()
const router = useRouter()

onMounted(() => store.load())

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

const summary = computed(() => {
  const rows = store.rows
  const active = rows.filter(row => row.tracking.activeThisWeek).length
  const late = rows.filter(row => row.tracking.needsFollowUp).length
  return [
    plural(rows.length, 'athlète', 'athlètes'),
    `${plural(active, 'actif', 'actifs')} cette semaine`,
    late ? `${late} à relancer` : '',
  ].filter(Boolean).join(' · ')
})

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// La semaine en points n'a de sens que si le plan est en cours et la semaine écrite
const showsWeek = (row: TrackingRow) => row.tracking.state?.status === 'running' && row.tracking.week != null

function open(row: TrackingRow) {
  if (row.profileId != null) router.push({ name: 'athlete', params: { profileId: row.profileId } })
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Suivi</h1>
      <p v-if="store.status === 'ready'" class="text-sm text-slate-500 mt-0.5">{{ summary }}</p>
    </div>

    <div v-if="store.status === 'idle' || store.status === 'loading'" class="text-slate-400 text-sm">Chargement…</div>

    <div v-else-if="store.status === 'error'" role="alert" class="flex items-center gap-3 text-sm text-red-600">
      Suivi indisponible pour le moment.
      <button type="button" class="font-medium underline" @click="store.load()">Réessayer</button>
    </div>

    <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <th class="px-4 py-3">Athlète</th>
            <th class="px-4 py-3">Plan</th>
            <th class="px-4 py-3">Cette semaine</th>
            <th class="px-4 py-3">Dernière activité</th>
            <th class="px-4 py-3">Assiduité</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="row in store.rows"
            :key="row.athlete.user.id"
            class="transition-colors"
            :class="row.profileId != null ? 'cursor-pointer hover:bg-slate-50' : ''"
            @click="open(row)"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="font-medium text-slate-900 whitespace-nowrap">{{ row.name }}</span>
                <span
                  v-if="row.tracking.needsFollowUp"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 whitespace-nowrap"
                >À relancer</span>
              </div>
            </td>

            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <PlanStateBadge :state="row.tracking.state" :total-weeks="row.tracking.totalWeeks" />
                <span class="text-slate-500 truncate max-w-56">{{ row.plan?.title ?? (row.profileId == null ? 'Profil à compléter' : 'Aucun plan') }}</span>
              </div>
            </td>

            <td class="px-4 py-3">
              <div v-if="showsWeek(row)" class="flex items-center gap-3">
                <WeekDots :days="row.tracking.days" />
                <span class="text-slate-600 tabular-nums whitespace-nowrap">
                  {{ row.tracking.completion.done }} / {{ row.tracking.completion.total }}
                </span>
              </div>
              <span v-else class="text-slate-300">—</span>
            </td>

            <td class="px-4 py-3 whitespace-nowrap" :class="row.tracking.needsFollowUp ? 'text-amber-700 font-medium' : 'text-slate-600'">
              <span :title="row.tracking.lastActivity ? formatDay(row.tracking.lastActivity) : ''">
                {{ relativeDay(row.tracking.daysSinceActivity) }}
              </span>
            </td>

            <td class="px-4 py-3">
              <div v-if="row.tracking.totals.adherence != null" class="flex items-center gap-2" :title="`${row.tracking.totals.dueDone} séances validées sur ${row.tracking.totals.due} prévues à ce jour`">
                <span class="w-10 text-right text-slate-700 tabular-nums">{{ row.tracking.totals.adherence }} %</span>
                <span class="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <span class="block h-full rounded-full bg-indigo-500" :style="{ width: `${row.tracking.totals.adherence}%` }" />
                </span>
              </div>
              <span v-else class="text-slate-300">—</span>
            </td>
          </tr>

          <tr v-if="store.rows.length === 0">
            <td colspan="5" class="px-4 py-12 text-center text-sm text-slate-400">Aucun athlète à suivre.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
