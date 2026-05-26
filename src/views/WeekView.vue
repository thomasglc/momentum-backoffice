<script setup lang="ts">
import { onMounted, computed, watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { useDirectus } from '@/composables/useDirectus'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import SessionCard from '@/components/week/SessionCard.vue'
import type { SessionType } from '@/types'

const route = useRoute()
const router = useRouter()
const store = usePlanStore()
const directus = useDirectus()

const planId = computed(() => Number(route.params.id))
const weekId = computed(() => Number(route.params.weekId))

onMounted(async () => {
  if (!store.currentPlan) await store.loadPlan(planId.value)
})

watch(planId, async (newId) => {
  await store.loadPlan(newId)
})

const week = computed(() => store.getWeekById(weekId.value))

const breadcrumb = computed(() => [
  { label: 'Plans', to: '/plans' },
  { label: store.currentPlan?.title ?? '…', to: `/plans/${planId.value}` },
  { label: week.value ? `Semaine ${week.value.week_number}` : '…' },
])

const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function sessionsForDay(dayLabel: string) {
  return (week.value?.sessions ?? []).filter((s) => s.day === dayLabel)
}

const allWeeks = computed(() => [...(store.currentPlan?.weeks ?? [])].sort((a, b) => a.week_number - b.week_number))
const currentIndex = computed(() => allWeeks.value.findIndex((w) => w.id === weekId.value))
const prevWeek = computed(() => allWeeks.value[currentIndex.value - 1])
const nextWeek = computed(() => allWeeks.value[currentIndex.value + 1])

// ── Delete session ───────────────────────────────────────────────────────────
const pendingDeleteId = ref<number | null>(null)
let cancelTimer: ReturnType<typeof setTimeout> | null = null

function requestDelete(id: number) {
  pendingDeleteId.value = id
  cancelTimer = setTimeout(() => { pendingDeleteId.value = null }, 3000)
}

function cancelDelete() {
  pendingDeleteId.value = null
  if (cancelTimer) clearTimeout(cancelTimer)
}

async function confirmDelete(sessionId: number) {
  if (cancelTimer) clearTimeout(cancelTimer)
  pendingDeleteId.value = null
  if (store.currentPlan) {
    for (const w of store.currentPlan.weeks) {
      const idx = w.sessions.findIndex(s => s.id === sessionId)
      if (idx !== -1) { w.sessions.splice(idx, 1); break }
    }
  }
  try {
    await directus.deleteSession(sessionId)
  } catch {
    await store.loadPlan(planId.value)
  }
}

// ── Add session ──────────────────────────────────────────────────────────────
const addingDay = ref<string | null>(null)
const sessionTypes: { value: SessionType; label: string }[] = [
  { value: 'running',  label: 'Running' },
  { value: 'hyrox',    label: 'Hyrox' },
  { value: 'brick',    label: 'Brick' },
  { value: 'strength', label: 'Musculation' },
  { value: 'mobility', label: 'Mobilité' },
  { value: 'recovery', label: 'Récupération' },
  { value: 'race',     label: 'Compétition' },
]
const newType = ref<SessionType>('running')
const newTitle = ref('')

function openAddForm(day: string) {
  addingDay.value = day
  newType.value = 'running'
  newTitle.value = ''
}

async function submitAdd() {
  if (!newTitle.value.trim() || !week.value) return
  const day = addingDay.value
  const type = newType.value
  const title = newTitle.value.trim()
  addingDay.value = null
  newTitle.value = ''
  try {
    const created = await directus.createCollectionItem('sessions', {
      week_id: week.value.id,
      day,
      type,
      title,
      optional: false,
    })
    const w = store.currentPlan?.weeks.find(w => w.id === weekId.value)
    if (w) w.sessions.push(created as import('@/types').Session)
  } catch {
    await store.loadPlan(planId.value)
  }
}
</script>

<template>
  <div>
    <AppBreadcrumb :items="breadcrumb" />

    <div v-if="!week" class="text-slate-400 text-sm">Chargement…</div>

    <template v-else>
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <h1 class="text-xl font-semibold text-slate-900">Semaine {{ week.week_number }}</h1>
            <span class="text-sm text-slate-400">Phase {{ week.phase }}</span>
            <span
              v-if="week.is_deload"
              class="text-xs font-medium px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full"
            >
              Décharge
            </span>
          </div>
          <p v-if="week.theme" class="text-slate-600">{{ week.theme }}</p>
          <p v-if="week.week_note" class="text-sm text-slate-400 mt-1 italic">{{ week.week_note }}</p>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="prevWeek"
            @click="router.push(`/plans/${planId}/weeks/${prevWeek.id}`)"
            class="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← S{{ prevWeek.week_number }}
          </button>
          <button
            v-if="nextWeek"
            @click="router.push(`/plans/${planId}/weeks/${nextWeek.id}`)"
            class="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            S{{ nextWeek.week_number }} →
          </button>
        </div>
      </div>

      <div class="grid grid-cols-7 gap-3">
        <div v-for="(dayLabel, i) in days" :key="i" class="flex flex-col gap-2">
          <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide">{{ dayLabel }}</div>

          <!-- Sessions existantes -->
          <div
            v-for="session in sessionsForDay(dayLabel)"
            :key="session.id"
            class="group relative"
          >
            <SessionCard :session="session" :plan-id="planId" />

            <!-- Icône suppression -->
            <button
              v-if="pendingDeleteId !== session.id"
              @click.prevent="requestDelete(session.id)"
              class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Supprimer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <!-- Confirmation suppression -->
            <div
              v-else
              @click.prevent
              class="absolute inset-0 rounded-lg bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5 border border-red-100"
            >
              <span class="text-xs text-slate-600 text-center px-1">Supprimer cette séance ?</span>
              <div class="flex gap-1">
                <button
                  @click.prevent="confirmDelete(session.id)"
                  class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors"
                >
                  Supprimer
                </button>
                <button
                  @click.prevent="cancelDelete()"
                  class="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>

          <!-- Formulaire ajout -->
          <div
            v-if="addingDay === dayLabel"
            class="border border-indigo-200 rounded-lg p-2 bg-indigo-50/50 space-y-1.5"
            @click.stop
          >
            <select
              v-model="newType"
              class="w-full px-1.5 py-1 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option v-for="t in sessionTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
            <input
              v-model="newTitle"
              type="text"
              placeholder="Titre"
              @keydown.enter="submitAdd"
              @keydown.esc="addingDay = null"
              class="w-full px-1.5 py-1 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autofocus
            />
            <div class="flex gap-1">
              <button
                @click="submitAdd"
                :disabled="!newTitle.trim()"
                class="flex-1 py-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors"
              >
                Créer
              </button>
              <button
                @click="addingDay = null"
                class="px-2 py-1 text-xs text-slate-500 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Placeholder jour vide -->
          <div
            v-if="sessionsForDay(dayLabel).length === 0 && addingDay !== dayLabel"
            class="h-20 border border-dashed border-slate-200 rounded-lg"
          />

          <!-- Bouton ajouter -->
          <button
            v-if="addingDay !== dayLabel"
            @click="openAddForm(dayLabel)"
            class="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-500 border border-slate-200 hover:border-indigo-300 transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
