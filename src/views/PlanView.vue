<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import WeekCard from '@/components/plan/WeekCard.vue'

const route = useRoute()
const store = usePlanStore()
const planId = Number(route.params.id)

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
  return Array.from(map.entries()).sort(([a], [b]) => a - b)
})
</script>

<template>
  <div>
    <AppBreadcrumb :items="breadcrumb" />

    <div v-if="store.isLoading" class="text-slate-400 text-sm">Chargement…</div>
    <div v-else-if="store.error" class="text-red-500 text-sm">{{ store.error }}</div>

    <template v-else-if="store.currentPlan">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">{{ store.currentPlan.title }}</h1>
          <p v-if="store.currentPlan.description" class="text-sm text-slate-500 mt-0.5">
            {{ store.currentPlan.description }}
          </p>
        </div>
      </div>

      <div v-for="[phase, weeks] in weeksByPhase" :key="phase" class="mb-8">
        <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Phase {{ phase }}</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <WeekCard
            v-for="week in weeks"
            :key="week.id"
            :week="week"
            :plan-id="planId"
          />
        </div>
      </div>
    </template>
  </div>
</template>
