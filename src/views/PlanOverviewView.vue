<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { useDirectus } from '@/composables/useDirectus'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import SessionCard from '@/components/week/SessionCard.vue'
import type { Week } from '@/types'

const route = useRoute()
const store = usePlanStore()
const directus = useDirectus()
const planId = Number(route.params.id)

onMounted(async () => {
  if (!store.currentPlan) await store.loadPlan(planId)
})

const breadcrumb = computed(() => [
  { label: 'Plans', to: '/plans' },
  { label: store.currentPlan?.title ?? '…', to: `/plans/${planId}` },
  { label: 'Toutes les séances' },
])

const weeksByPhase = computed(() => {
  if (!store.currentPlan) return []
  const map = new Map<number, Week[]>()
  for (const week of store.currentPlan.weeks) {
    if (!map.has(week.phase)) map.set(week.phase, [])
    map.get(week.phase)!.push(week)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([phase, weeks]) => ({
      phase,
      weeks: [...weeks].sort((a, b) => a.week_number - b.week_number),
    }))
})

const dayOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

// ── Delete session ────────────────────────────────────────────────────────────
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
    await store.loadPlan(planId)
  }
}
</script>

<template>
  <div>
    <AppBreadcrumb :items="breadcrumb" />

    <div v-if="store.isLoading" class="text-slate-400 text-sm">Chargement…</div>

    <template v-else-if="store.currentPlan">
      <div class="flex items-baseline gap-3 mb-8">
        <h1 class="text-xl font-semibold text-slate-900">{{ store.currentPlan.title }}</h1>
      </div>

      <!-- Header des jours (fixe) -->
      <div class="flex gap-4 mb-3 sticky top-0 bg-slate-50 py-2 z-10">
        <div class="shrink-0 w-44" />
        <div class="flex-1 grid grid-cols-7 gap-2">
          <div
            v-for="day in dayOrder"
            :key="day"
            class="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center"
          >
            {{ day.slice(0, 3) }}
          </div>
        </div>
      </div>

      <div v-for="{ phase, weeks } in weeksByPhase" :key="phase" class="mb-10">

        <!-- En-tête de phase -->
        <div class="flex items-center gap-3 mb-4">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">Phase {{ phase }}</span>
          <div class="flex-1 h-px bg-slate-200" />
        </div>

        <!-- Ligne par semaine -->
        <div v-for="week in weeks" :key="week.id" class="flex gap-4 mb-4 items-start">

          <!-- Label semaine -->
          <RouterLink
            :to="`/plans/${planId}/weeks/${week.id}`"
            class="shrink-0 w-44 pt-3 group"
          >
            <div class="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
              Semaine {{ week.week_number }}
            </div>
            <div v-if="week.theme" class="text-xs text-slate-400 mt-0.5">{{ week.theme }}</div>
            <span
              v-if="week.is_deload"
              class="inline-block text-xs font-medium px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded mt-1"
            >Décharge</span>
          </RouterLink>

          <!-- Grille 7 jours -->
          <div class="flex-1 grid grid-cols-7 gap-2">
            <div v-for="day in dayOrder" :key="day" class="space-y-2">
              <template v-if="week.sessions.filter(s => s.day === day).length">
                <div
                  v-for="session in week.sessions.filter(s => s.day === day)"
                  :key="session.id"
                  class="group relative"
                >
                  <SessionCard :session="session" :plan-id="planId" />

                  <!-- Icône suppression -->
                  <button
                    v-if="pendingDeleteId !== session.id"
                    @click.prevent="requestDelete(session.id)"
                    class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
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
                    <span class="text-xs text-slate-600 text-center px-1">Supprimer ?</span>
                    <div class="flex gap-1">
                      <button
                        @click.prevent="confirmDelete(session.id)"
                        class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors"
                      >
                        Oui
                      </button>
                      <button
                        @click.prevent="cancelDelete()"
                        class="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                      >
                        Non
                      </button>
                    </div>
                  </div>
                </div>
              </template>
              <div
                v-else
                class="h-full min-h-16 border border-dashed border-slate-200 rounded-xl"
              />
            </div>
          </div>
        </div>

        <!-- Séparateur entre phases -->
        <div class="h-px bg-slate-100 mt-6" />
      </div>
    </template>
  </div>
</template>
