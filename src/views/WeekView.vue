<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import SessionCard from '@/components/week/SessionCard.vue'

const route = useRoute()
const router = useRouter()
const store = usePlanStore()

const planId = Number(route.params.id)
const weekId = Number(route.params.weekId)

onMounted(async () => {
  if (!store.currentPlan) await store.loadPlan(planId)
})

const week = computed(() => {
  const w = store.getWeekById(weekId)
  // eslint-disable-next-line no-console
  console.log('[WeekView] week:', w, '| sessions:', w?.sessions)
  return w
})

const breadcrumb = computed(() => [
  { label: 'Plans', to: '/plans' },
  { label: store.currentPlan?.title ?? '…', to: `/plans/${planId}` },
  { label: week.value ? `Semaine ${week.value.week_number}` : '…' },
])

const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function sessionsForDay(dayLabel: string) {
  return (week.value?.sessions ?? []).filter((s) => s.day === dayLabel)
}

const allWeeks = computed(() => [...(store.currentPlan?.weeks ?? [])].sort((a, b) => a.week_number - b.week_number))
const currentIndex = computed(() => allWeeks.value.findIndex((w) => w.id === weekId))
const prevWeek = computed(() => allWeeks.value[currentIndex.value - 1])
const nextWeek = computed(() => allWeeks.value[currentIndex.value + 1])
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
              class="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full"
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
        <div v-for="(dayLabel, i) in days" :key="i">
          <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{{ dayLabel }}</div>
          <div class="space-y-2">
            <SessionCard
              v-for="session in sessionsForDay(dayLabel)"
              :key="session.id"
              :session="session"
              :plan-id="planId"
            />
            <div
              v-if="sessionsForDay(dayLabel).length === 0"
              class="h-12 border border-dashed border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
