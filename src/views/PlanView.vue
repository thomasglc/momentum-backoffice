<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import AppToast from '@/components/ui/AppToast.vue'
import WeekCard from '@/components/plan/WeekCard.vue'
import type { Week } from '@/types'

const route = useRoute()
const router = useRouter()
const store = usePlanStore()
const planId = Number(route.params.id)
const toast = ref<InstanceType<typeof AppToast> | null>(null)

onMounted(() => store.loadPlan(planId))

const breadcrumb = computed(() => [
  { label: 'Plans', to: '/plans' },
  { label: store.currentPlan?.title ?? '…' },
])

const weeksByPhase = computed(() => {
  if (!store.currentPlan) return []
  const map = new Map<number, typeof store.currentPlan.weeks>()
  for (const week of store.currentPlan.weeks) {
    if (!map.has(week.phase)) map.set(week.phase, [])
    map.get(week.phase)!.push(week)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([phase, weeks]) => [phase, [...weeks].sort((a, b) => a.week_number - b.week_number)] as const)
})

const phaseTitle = (phase: number) => {
  const name = store.currentPlan?.phase_names?.[phase]
  return name ? `Phase ${phase} · ${name}` : `Phase ${phase}`
}

// Semaines écrites sur la durée annoncée du plan
const progress = computed(() => {
  const plan = store.currentPlan
  if (!plan) return ''
  const written = plan.weeks.length
  const label = `${written} semaine${written > 1 ? 's' : ''} écrite${written > 1 ? 's' : ''}`
  return plan.total_weeks ? `${label} sur ${plan.total_weeks}` : label
})

// ── Ajouter et dupliquer une semaine ─────────────────────────────────────────
const busy = ref(false)

async function addWeek() {
  if (busy.value) return
  busy.value = true
  try {
    const week = await store.addWeek()
    router.push(`/plans/${planId}/weeks/${week.id}`)
  } catch {
    toast.value?.show('Semaine non créée', 'error')
  } finally {
    busy.value = false
  }
}

async function duplicateWeek(week: Week) {
  if (busy.value) return
  busy.value = true
  try {
    const copy = await store.duplicateWeek(week.id)
    toast.value?.show(`Semaine ${week.week_number} dupliquée${copy ? ` en semaine ${copy.week_number}` : ''}`)
  } catch (error) {
    toast.value?.show(error instanceof Error ? error.message : 'Copie de la semaine interrompue', 'error')
    await store.loadPlan(planId)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <AppBreadcrumb :items="breadcrumb" />

    <!-- Tant que le plan chargé est un autre plan, on attend : pas de semaines du plan précédent à l'écran -->
    <div v-if="store.isLoading && store.currentPlan?.id !== planId" class="text-slate-400 text-sm">Chargement…</div>
    <div v-else-if="store.error" class="text-red-500 text-sm">{{ store.error }}</div>

    <template v-else-if="store.currentPlan?.id === planId">
      <div class="flex items-center justify-between gap-4 mb-6">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold text-slate-900">{{ store.currentPlan.title }}</h1>
          <p v-if="store.currentPlan.description" class="text-sm text-slate-500 mt-0.5">
            {{ store.currentPlan.description }}
          </p>
          <p class="text-xs text-slate-400 mt-1">{{ progress }}</p>
        </div>
        <button
          @click="addWeek"
          :disabled="busy"
          class="shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Ajouter une semaine
        </button>
      </div>

      <p v-if="busy" role="status" class="text-xs font-medium text-indigo-600 mb-4">Enregistrement en cours…</p>

      <p
        v-if="store.currentPlan.weeks.length === 0"
        class="bg-white border border-dashed border-slate-300 rounded-xl px-6 py-10 text-sm text-slate-500 text-center"
      >
        Ce plan n'a pas encore de semaine. Ajoute la première, puis duplique-la pour aller plus vite.
      </p>

      <div v-for="[phase, weeks] in weeksByPhase" :key="phase" class="mb-8">
        <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{{ phaseTitle(phase) }}</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <WeekCard
            v-for="week in weeks"
            :key="week.id"
            :week="week"
            :plan-id="planId"
            :busy="busy"
            @duplicate="duplicateWeek"
          />
        </div>
      </div>
    </template>

    <AppToast ref="toast" />
  </div>
</template>
