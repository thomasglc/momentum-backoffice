<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { useDirectus } from '@/composables/useDirectus'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import SessionTypeBadge from '@/components/ui/SessionTypeBadge.vue'
import IntensityBar from '@/components/ui/IntensityBar.vue'
import BlockList from '@/components/session/BlockList.vue'
import BlockDrawer from '@/components/editor/BlockDrawer.vue'
import type { BlockType, ResolvedBlock } from '@/types'

const route = useRoute()
const store = usePlanStore()
const directus = useDirectus()

const planId = Number(route.params.id)
const sessionId = Number(route.params.sessionId)

const editingBlock = ref<ResolvedBlock | null>(null)
const showAddPicker = ref(false)

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

const blockTypes: { type: BlockType; label: string; color: string }[] = [
  { type: 'block_cardio',             label: 'Cardio',       color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { type: 'block_intervals',          label: 'Intervalles',  color: 'bg-violet-100 text-violet-700 hover:bg-violet-200' },
  { type: 'block_strength',           label: 'Musculation',  color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
  { type: 'block_circuit',            label: 'Circuit',      color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  { type: 'block_mini_race',          label: 'Mini Race',    color: 'bg-red-100 text-red-700 hover:bg-red-200' },
  { type: 'block_station_activation', label: 'Activation',   color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  { type: 'block_station_block',      label: 'Brick',        color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
]

const blockDefaults: Record<BlockType, Record<string, unknown>> = {
  block_cardio:             { subtype: 'run' },
  block_intervals:          {},
  block_strength:           {},
  block_circuit:            { format: 'rounds' },
  block_mini_race:          {},
  block_station_activation: {},
  block_station_block:      { brick_format: 'standard' },
}

async function deleteBlock(block: ResolvedBlock) {
  const idx = store.currentBlocks.findIndex(b => b.meta.id === block.meta.id)
  if (idx !== -1) store.currentBlocks.splice(idx, 1)
  try {
    await directus.deleteCollectionItem('session_blocks', block.meta.id)
    await directus.deleteCollectionItem(block.meta.block_type, block.meta.block_id)
  } catch {
    await store.loadSession(sessionId)
  }
}

async function addBlock(blockType: BlockType) {
  showAddPicker.value = false
  try {
    const created = await directus.createCollectionItem(blockType, blockDefaults[blockType]) as { id: number }
    const sb = await directus.createCollectionItem('session_blocks', {
      session_id: sessionId,
      block_type: blockType,
      block_id: created.id,
      position: store.currentBlocks.length + 1,
    }) as { id: number; session_id: number; position: number; block_type: BlockType; block_id: number }
    const blockData = await directus.fetchBlock(blockType, created.id)
    store.currentBlocks.push({
      meta: { id: sb.id, session_id: sb.session_id, position: sb.position, block_type: blockType, block_id: created.id },
      data: blockData,
    })
  } catch {
    await store.loadSession(sessionId)
  }
}
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

      <BlockList
        :blocks="blocks"
        :on-edit="(b) => (editingBlock = b)"
        :on-delete="deleteBlock"
      />

      <!-- Add block -->
      <div class="mt-4">
        <div v-if="!showAddPicker">
          <button
            @click="showAddPicker = true"
            class="flex items-center gap-2 px-4 py-2.5 w-full border border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter un bloc
          </button>
        </div>
        <div v-else class="border border-slate-200 rounded-xl p-4 bg-slate-50">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Choisir le type de bloc</span>
            <button @click="showAddPicker = false" class="text-slate-400 hover:text-slate-600 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="bt in blockTypes"
              :key="bt.type"
              @click="addBlock(bt.type)"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              :class="bt.color"
            >
              {{ bt.label }}
            </button>
          </div>
        </div>
      </div>

      <BlockDrawer
        v-if="editingBlock"
        :block="editingBlock"
        @close="editingBlock = null"
        @saved="editingBlock = null; store.loadSession(sessionId)"
      />
    </template>
  </div>
</template>
