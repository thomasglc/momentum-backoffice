<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import SessionTypeBadge from '@/components/ui/SessionTypeBadge.vue'
import IntensityBar from '@/components/ui/IntensityBar.vue'
import BlockList from '@/components/session/BlockList.vue'
import BlockDrawer from '@/components/editor/BlockDrawer.vue'
import type { ResolvedBlock } from '@/types'

const route = useRoute()
const store = usePlanStore()

const planId = Number(route.params.id)
const sessionId = Number(route.params.sessionId)

const editingBlock = ref<ResolvedBlock | null>(null)

onMounted(async () => {
  if (!store.currentPlan) await store.loadPlan(planId)
  await store.loadSession(sessionId)
})

const session = computed(() => store.currentSession)
const blocks = computed(() => store.currentBlocks)

const week = computed(() => {
  const weekId = session.value?.week_id
  return weekId ? store.getWeekById(weekId) : null
})

const breadcrumb = computed(() => [
  { label: 'Plans', to: '/plans' },
  { label: store.currentPlan?.title ?? '…', to: `/plans/${planId}` },
  { label: week.value ? `Semaine ${week.value.week_number}` : '…', to: week.value ? `/plans/${planId}/weeks/${week.value.id}` : undefined },
  { label: session.value?.title ?? '…' },
])

</script>

<template>
  <div>
    <AppBreadcrumb :items="breadcrumb" />

    <div v-if="store.isLoading" class="text-slate-400 text-sm">Chargement…</div>
    <div v-else-if="store.error" class="text-red-500 text-sm">{{ store.error }}</div>

    <template v-else-if="session">
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
          <SessionTypeBadge :type="session.type" />
          <span class="text-sm text-slate-400">{{ session.day }}</span>
          <span v-if="session.optional" class="text-xs text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
            Optionnel
          </span>
        </div>
        <h1 class="text-xl font-semibold text-slate-900">{{ session.title }}</h1>
        <p v-if="session.description" class="text-slate-500 text-sm mt-1">{{ session.description }}</p>

        <div class="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500">
          <span v-if="session.duration_min">{{ session.duration_min }} min</span>
          <span v-if="session.focus">{{ session.focus }}</span>
        </div>

        <IntensityBar v-if="session.intensity_score" :score="session.intensity_score" class="mt-3" />

        <div
          v-if="session.coach_tip"
          class="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm italic text-indigo-700"
        >
          {{ session.coach_tip }}
        </div>
      </div>

      <BlockList :blocks="blocks" :on-edit="(b) => (editingBlock = b)" />

      <BlockDrawer
        v-if="editingBlock"
        :block="editingBlock"
        @close="editingBlock = null"
        @saved="editingBlock = null; store.loadSession(sessionId)"
      />
    </template>
  </div>
</template>
