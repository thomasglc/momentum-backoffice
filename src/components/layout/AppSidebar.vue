<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlanStore } from '@/stores/plan'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const planStore = usePlanStore()

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

const planId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

const isInPlan = computed(() => planId.value !== null)

const weeksByPhase = computed(() => {
  if (!planStore.currentPlan) return []
  const map = new Map<number, typeof planStore.currentPlan.weeks>()
  for (const week of planStore.currentPlan.weeks) {
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

const activeWeekId = computed(() => {
  const id = route.params.weekId
  return id ? Number(id) : null
})
</script>

<template>
  <aside class="w-56 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0">
    <div class="px-4 py-5 border-b border-slate-200 shrink-0">
      <span class="text-base font-semibold text-slate-900">Momentum</span>
      <span class="block text-xs text-slate-400 mt-0.5">Back office</span>
    </div>

    <!-- Nav générique -->
    <nav v-if="!isInPlan" class="flex-1 px-3 py-4 space-y-1">
      <RouterLink
        to="/plans"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        active-class="bg-indigo-50 text-indigo-700"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Plans
      </RouterLink>
    </nav>

    <!-- Nav plan -->
    <template v-else>
      <div class="px-3 pt-3 pb-2 shrink-0">
        <RouterLink
          to="/plans"
          class="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Tous les plans
        </RouterLink>
      </div>

      <div v-if="planStore.currentPlan" class="px-4 pb-2 shrink-0">
        <RouterLink
          :to="`/plans/${planId}`"
          class="block text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors truncate"
          :class="route.name === 'plan' ? 'text-indigo-600' : ''"
        >
          {{ planStore.currentPlan.title }}
        </RouterLink>
        <span class="text-xs text-slate-400">{{ planStore.currentPlan.weeks.length }} semaines</span>
      </div>
      <div v-else class="px-4 pb-2 shrink-0">
        <div class="h-4 w-32 bg-slate-100 rounded animate-pulse" />
      </div>

      <div class="flex-1 overflow-y-auto px-3 pb-4">
        <div v-for="{ phase, weeks } in weeksByPhase" :key="phase" class="mb-3">
          <div class="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Phase {{ phase }}
          </div>
          <div class="space-y-0.5">
            <RouterLink
              v-for="week in weeks"
              :key="week.id"
              :to="`/plans/${planId}/weeks/${week.id}`"
              class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors"
              :class="activeWeekId === week.id
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            >
              <span class="tabular-nums text-xs font-mono w-5 shrink-0 text-center"
                :class="activeWeekId === week.id ? 'text-indigo-500' : 'text-slate-400'">
                {{ week.week_number }}
              </span>
              <span class="truncate leading-snug">
                {{ week.theme ?? `Semaine ${week.week_number}` }}
              </span>
              <span
                v-if="week.is_deload"
                class="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400"
                title="Décharge"
              />
            </RouterLink>
          </div>
        </div>
      </div>
    </template>

    <div class="px-3 py-4 border-t border-slate-200 shrink-0">
      <button
        @click="handleLogout"
        class="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Déconnexion
      </button>
    </div>
  </aside>
</template>
