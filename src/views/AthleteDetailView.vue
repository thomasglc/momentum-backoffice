<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDirectus } from '@/composables/useDirectus'
import { useTrackingStore } from '@/stores/tracking'
import {
  DAYS, exerciseProgress, formatHours, formatNumber, formatTonnage, planTimeline, sessionDate, sessionSets,
  totalVolumeKg, weekCompletion,
} from '@/utils/progress'
import type { ProgressSession, ProgressSet, ProgressWeek, TimelineEntry } from '@/utils/progress'
import { relativeDay } from '@/utils/tracking'
import type { SessionType, SetLogRow } from '@/types'
import PlanStateBadge from '@/components/tracking/PlanStateBadge.vue'
import SessionTypeBadge from '@/components/ui/SessionTypeBadge.vue'

const route = useRoute()
const store = useTrackingStore()
const directus = useDirectus()

const profileId = computed(() => Number(route.params.profileId))
const row = computed(() => store.rowOf(profileId.value))
const tracking = computed(() => row.value?.tracking ?? null)

// ── Séries enregistrées de l'athlète ─────────────────────────────────────────
const sets = shallowRef<ProgressSet[]>([])
const setsStatus = ref<'loading' | 'ready' | 'error'>('loading')

function toProgressSet(log: SetLogRow): ProgressSet {
  const exercise = log.exercise_id
  const expanded = exercise !== null && typeof exercise === 'object'
  return {
    exerciseId: expanded ? exercise.id : exercise,
    name: expanded ? exercise.name : null,
    sessionId: log.session_id,
    setNumber: log.set_number,
    weightKg: log.weight_kg,
    reps: log.reps,
    durationSec: log.duration_sec,
    date: log.date_created,
  }
}

async function loadSets() {
  setsStatus.value = 'loading'
  try {
    sets.value = (await directus.fetchSetLogs(profileId.value)).map(toProgressSet)
    setsStatus.value = 'ready'
  } catch {
    setsStatus.value = 'error'
  }
}

onMounted(() => {
  if (store.status !== 'ready') store.load()
  loadSets()
})
watch(profileId, loadSets)

// ── En-tête ──────────────────────────────────────────────────────────────────
const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const formatRange = (start: string | null, end: string | null) =>
  (start && end ? `${shortDate(`${start}T00:00:00`)} – ${shortDate(`${end}T00:00:00`)}` : '')

const race = computed(() => {
  const date = row.value?.athlete.profile?.race_date
  if (!date) return ''
  const days = tracking.value?.state?.daysToRace
  return `Course le ${longDate(date)}${days != null && days >= 0 ? ` (J-${days})` : ''}`
})

// ── Totaux ───────────────────────────────────────────────────────────────────
const tiles = computed(() => {
  const t = tracking.value
  if (!t) return []
  const planSessions = new Set(t.weeks.flatMap(week => week.sessions.map(session => session.id)))
  const volume = totalVolumeKg(sets.value.filter(set => set.sessionId != null && planSessions.has(set.sessionId)))
  const unknown = setsStatus.value !== 'ready'
  return [
    { label: 'Séances', value: String(t.totals.sessionsDone), hint: t.totals.sessionsDone > 1 ? 'validées' : 'validée' },
    {
      label: 'Assiduité',
      value: t.totals.adherence == null ? '—' : `${t.totals.adherence} %`,
      hint: t.totals.adherence == null ? 'pas encore de séance échue' : `${t.totals.dueDone} sur ${t.totals.due} prévues à ce jour`,
    },
    { label: 'Heures', value: formatHours(t.totals.minutes), hint: 'durée notée, sinon prévue' },
    { label: 'Volume', value: unknown ? '—' : formatTonnage(volume), hint: 'levé en muscu' },
    { label: 'Distance', value: t.totals.km > 0 ? `${formatNumber(t.totals.km)} km` : '—', hint: 'notée par l\'athlète' },
  ]
})

// ── Frise du plan ────────────────────────────────────────────────────────────
const timeline = computed<TimelineEntry[]>(() => {
  const t = tracking.value
  if (!t) return []
  return planTimeline(t.weeks, t.totalWeeks, t.isDone, { status: t.state?.status ?? null, weekNumber: t.state?.weekNumber ?? 1 })
})

const CELL: Record<TimelineEntry['state'], string> = {
  done: 'bg-indigo-500',
  partial: 'bg-indigo-300',
  missed: 'bg-slate-200',
  none: 'bg-slate-100',
  current: 'bg-indigo-200 ring-2 ring-slate-900 ring-offset-1',
  upcoming: 'bg-indigo-50',
}
const cellClass = (entry: TimelineEntry) => (entry.written ? CELL[entry.state] : 'border border-dashed border-slate-300')
const cellTitle = (entry: TimelineEntry) =>
  (entry.written ? `S${entry.number} · ${entry.done}/${entry.total} séances validées` : `S${entry.number} · pas encore programmée`)

// ── Semaines et séances ──────────────────────────────────────────────────────
type SessionStatus = 'done' | 'today' | 'late' | 'missed' | 'upcoming'
const STATUS_LABEL: Record<Exclude<SessionStatus, 'done'>, string> = {
  today: 'aujourd\'hui',
  late: 'à rattraper',
  missed: 'non validée',
  upcoming: 'à venir',
}

function sessionRow(session: ProgressSession, week: ProgressWeek, isCurrent: boolean) {
  const t = tracking.value!
  const detail = t.detailOf(session.id)
  const date = sessionDate(week.startDate, session.day)
  let status: SessionStatus = 'missed'
  if (detail) status = 'done'
  else if (date && date === store.today) status = 'today'
  else if (date && date > store.today) status = 'upcoming'
  else if (date && isCurrent) status = 'late'
  const facts = detail ? [
    detail.completedAt ? `validée le ${shortDate(detail.completedAt)}` : 'validée',
    detail.durationSec != null ? formatHours(detail.durationSec / 60) : '',
    detail.distanceKm != null ? `${formatNumber(detail.distanceKm)} km` : '',
  ].filter(Boolean) : []
  return { session, status, facts, exercises: sessionSets(sets.value, session.id) }
}

const dayIndex = (day: string) => {
  const index = (DAYS as readonly string[]).indexOf(day)
  return index < 0 ? DAYS.length : index
}

// Semaines jusqu'à celle du jour, la plus récente d'abord ; toutes si le plan est terminé ou sans calendrier
const weeks = computed(() => {
  const t = tracking.value
  if (!t) return []
  const state = t.state
  const upTo = !state || state.status === 'done' ? Infinity : state.status === 'before' ? 0 : state.weekNumber
  return t.weeks
    .filter(week => week.weekNumber <= upTo)
    .sort((a, b) => b.weekNumber - a.weekNumber)
    .map((week) => {
      const isCurrent = state?.status === 'running' && week.weekNumber === state.weekNumber
      return {
        week,
        isCurrent,
        completion: weekCompletion(week, t.isDone),
        dates: formatRange(week.startDate, week.endDate),
        sessions: [...week.sessions].sort((a, b) => dayIndex(a.day) - dayIndex(b.day)).map(session => sessionRow(session, week, isCurrent)),
      }
    })
})

// ── Charges ──────────────────────────────────────────────────────────────────
const UNIT = { kg: 'kg', reps: 'reps', s: 's' } as const
const loads = computed(() => exerciseProgress(sets.value).map((load) => {
  const diff = Math.round((load.last - load.first) * 10) / 10
  return {
    ...load,
    range: diff ? `${formatNumber(load.first)} → ${formatNumber(load.last)} ${UNIT[load.unit]}` : `${formatNumber(load.last)} ${UNIT[load.unit]}`,
    delta: diff ? `${diff > 0 ? '+' : '−'}${formatNumber(Math.abs(diff))}` : '',
    up: diff > 0,
  }
}))
</script>

<template>
  <div>
    <RouterLink to="/suivi" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Suivi
    </RouterLink>

    <div v-if="store.status === 'idle' || store.status === 'loading'" class="text-slate-400 text-sm">Chargement…</div>
    <div v-else-if="store.status === 'error'" role="alert" class="flex items-center gap-3 text-sm text-red-600">
      Fiche indisponible pour le moment.
      <button type="button" class="font-medium underline" @click="store.load()">Réessayer</button>
    </div>
    <p v-else-if="!row || !tracking" class="text-sm text-slate-500">Athlète introuvable.</p>

    <template v-else>
      <!-- Où il en est -->
      <header class="mb-6">
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-xl font-semibold text-slate-900">{{ row.name }}</h1>
          <PlanStateBadge :state="tracking.state" :total-weeks="tracking.totalWeeks" />
          <span v-if="tracking.needsFollowUp" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">À relancer</span>
        </div>
        <p class="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-2">
          <RouterLink v-if="row.plan" :to="`/plans/${row.plan.id}`" class="text-indigo-600 hover:underline">{{ row.plan.title }}</RouterLink>
          <span v-if="race">· {{ race }}</span>
          <span>· Dernière activité : {{ relativeDay(tracking.daysSinceActivity) }}</span>
        </p>
      </header>

      <!-- Totaux -->
      <dl class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div v-for="tile in tiles" :key="tile.label" class="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ tile.label }}</dt>
          <dd class="mt-1 text-2xl font-semibold text-slate-900 tabular-nums whitespace-nowrap">{{ tile.value }}</dd>
          <dd class="text-xs text-slate-500">{{ tile.hint }}</dd>
        </div>
      </dl>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <!-- Semaines et séances -->
        <section class="xl:col-span-2 space-y-3">
          <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Semaines</h2>

          <p v-if="tracking.state?.status === 'before'" class="bg-white rounded-xl border border-slate-200 px-4 py-6 text-sm text-slate-500 text-center">
            Le plan n'a pas encore commencé.
          </p>
          <p v-else-if="!weeks.length" class="bg-white rounded-xl border border-slate-200 px-4 py-6 text-sm text-slate-500 text-center">
            Aucune semaine programmée.
          </p>

          <article v-for="entry in weeks" :key="entry.week.weekNumber" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <header class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100" :class="entry.isCurrent ? 'bg-indigo-50/60' : 'bg-slate-50/60'">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-semibold text-slate-900 tabular-nums">S{{ entry.week.weekNumber }}</span>
                <span class="text-sm text-slate-600 truncate">{{ entry.week.theme }}</span>
                <span v-if="entry.week.isDeload" class="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Décharge</span>
                <span v-if="entry.isCurrent" class="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">En cours</span>
              </div>
              <div class="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                <span v-if="entry.dates">{{ entry.dates }}</span>
                <span
                  class="font-semibold tabular-nums"
                  :class="entry.completion.complete ? 'text-emerald-600' : 'text-slate-700'"
                >{{ entry.completion.done }} / {{ entry.completion.total }}</span>
              </div>
            </header>

            <ul class="divide-y divide-slate-100">
              <li v-for="item in entry.sessions" :key="item.session.id" class="px-4 py-2.5">
                <div class="flex items-center gap-3">
                  <span
                    class="w-5 h-5 shrink-0 rounded-full flex items-center justify-center"
                    :class="{
                      'bg-emerald-500 text-white': item.status === 'done',
                      'border-2 border-amber-400 bg-amber-50': item.status === 'late',
                      'border-2 border-indigo-500': item.status === 'today',
                      'border-2 border-slate-200': item.status === 'missed' || item.status === 'upcoming',
                    }"
                    aria-hidden="true"
                  >
                    <svg v-if="item.status === 'done'" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span class="w-20 shrink-0 text-xs text-slate-500">{{ item.session.day }}</span>
                  <span class="flex-1 min-w-0 flex items-center gap-2">
                    <span class="text-sm text-slate-900 truncate" :class="{ 'text-slate-500': item.status === 'missed' }">{{ item.session.title }}</span>
                    <SessionTypeBadge :type="(item.session.type as SessionType)" />
                    <span v-if="item.session.optional" class="text-xs text-slate-400">optionnelle</span>
                  </span>
                  <span v-if="item.status === 'done'" class="shrink-0 text-xs text-slate-600 tabular-nums">{{ item.facts.join(' · ') }}</span>
                  <span
                    v-else
                    class="shrink-0 text-xs"
                    :class="item.status === 'late' ? 'text-amber-700 font-medium' : item.status === 'today' ? 'text-indigo-600 font-medium' : 'text-slate-400'"
                  >{{ STATUS_LABEL[item.status] }}</span>
                </div>

                <!-- Séries enregistrées pendant la séance -->
                <ul v-if="item.exercises.length" class="mt-2 ml-8 pl-3 border-l-2 border-slate-100 space-y-0.5">
                  <li v-for="exercise in item.exercises" :key="exercise.exerciseId ?? exercise.name" class="flex items-baseline gap-2 text-xs">
                    <span class="text-slate-500 w-52 shrink-0 truncate">{{ exercise.name }}</span>
                    <span class="text-slate-800 tabular-nums">{{ exercise.summary }}</span>
                  </li>
                </ul>
              </li>
            </ul>
          </article>
        </section>

        <div class="space-y-6">
          <!-- Frise du plan -->
          <section v-if="timeline.length" class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Plan</h2>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="entry in timeline"
                :key="entry.number"
                class="w-4 h-6 rounded"
                :class="cellClass(entry)"
                :title="cellTitle(entry)"
              />
            </div>
            <p class="mt-3 text-xs text-slate-500">Une case par semaine : validée, entamée, non validée, à venir ; en pointillé, pas encore programmée.</p>
          </section>

          <!-- Charges par exercice -->
          <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 pt-4 pb-2">Charges</h2>
            <p v-if="setsStatus === 'loading'" class="px-4 pb-4 text-sm text-slate-400">Chargement…</p>
            <p v-else-if="setsStatus === 'error'" role="alert" class="px-4 pb-4 text-sm text-red-600">Séries indisponibles pour le moment.</p>
            <p v-else-if="!loads.length" class="px-4 pb-4 text-sm text-slate-500">Aucune série enregistrée.</p>
            <ul v-else class="divide-y divide-slate-100">
              <li v-for="load in loads" :key="load.exerciseId" class="px-4 py-2.5 flex items-center gap-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-slate-900 truncate">{{ load.name }}</p>
                  <p class="text-xs text-slate-500">{{ load.sessions }} {{ load.sessions > 1 ? 'séances' : 'séance' }}</p>
                </div>
                <span class="shrink-0 text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">{{ load.range }}</span>
                <span
                  v-if="load.delta"
                  class="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded tabular-nums"
                  :class="load.up ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                >{{ load.delta }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
