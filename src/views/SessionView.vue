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
import CopySessionDrawer from '@/components/session/CopySessionDrawer.vue'
import type { BlockType, ResolvedBlock, SessionType } from '@/types'

const route = useRoute()
const store = usePlanStore()
const directus = useDirectus()

const planId = Number(route.params.id)
const sessionId = Number(route.params.sessionId)

const editingBlock = ref<ResolvedBlock | null>(null)
const showAddPicker = ref(false)
const showCopyDrawer = ref(false)

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
  block_intervals:          { sets: 1 },
  block_strength:           {},
  block_circuit:            { format: 'rounds' },
  block_mini_race:          { rounds: 1 },
  block_station_activation: { rounds: 1 },
  block_station_block:      { brick_format: 'standard' },
}

// ── Edit session ─────────────────────────────────────────────────────────────
const editingSession = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const editType = ref<SessionType>('running')
const editDay = ref('')
const editDurationMin = ref<number | null>(null)
const editIntensityScore = ref<number | null>(null)
const editFocus = ref('')
const editCoachTip = ref('')
const editOptional = ref(false)
const isSavingSession = ref(false)

const sessionTypes: { value: SessionType; label: string }[] = [
  { value: 'running',  label: 'Running' },
  { value: 'hyrox',    label: 'Hyrox' },
  { value: 'brick',    label: 'Brick' },
  { value: 'strength', label: 'Musculation' },
  { value: 'mobility', label: 'Mobilité' },
  { value: 'recovery', label: 'Récupération' },
  { value: 'race',     label: 'Compétition' },
]
const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function openEditSession() {
  const s = session.value
  if (!s) return
  editTitle.value = s.title
  editDescription.value = s.description ?? ''
  editType.value = s.type
  editDay.value = s.day
  editDurationMin.value = s.duration_min
  editIntensityScore.value = s.intensity_score
  editFocus.value = s.focus ?? ''
  editCoachTip.value = s.coach_tip ?? ''
  editOptional.value = !!s.optional
  editingSession.value = true
}

async function saveSession() {
  if (!session.value || !editTitle.value.trim()) return
  isSavingSession.value = true
  const s = store.currentSession
  if (s) {
    s.title = editTitle.value.trim()
    s.description = editDescription.value || null
    s.type = editType.value
    s.day = editDay.value
    s.duration_min = editDurationMin.value
    s.intensity_score = editIntensityScore.value
    s.focus = editFocus.value || null
    s.coach_tip = editCoachTip.value || null
    s.optional = editOptional.value
  }
  const sessionInPlan = store.currentPlan?.weeks.flatMap(w => w.sessions).find(s => s.id === sessionId)
  if (sessionInPlan) {
    sessionInPlan.title = editTitle.value.trim()
    sessionInPlan.type = editType.value
    sessionInPlan.day = editDay.value
    sessionInPlan.duration_min = editDurationMin.value
    sessionInPlan.intensity_score = editIntensityScore.value
    sessionInPlan.optional = editOptional.value
  }
  editingSession.value = false
  try {
    await directus.updateCollectionItem('sessions', sessionId, {
      title: editTitle.value.trim(),
      description: editDescription.value || null,
      type: editType.value,
      day: editDay.value,
      duration_min: editDurationMin.value,
      intensity_score: editIntensityScore.value,
      focus: editFocus.value || null,
      coach_tip: editCoachTip.value || null,
      optional: editOptional.value,
    })
  } catch {
    await store.loadSession(sessionId)
  } finally {
    isSavingSession.value = false
  }
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
        <!-- Affichage normal -->
        <template v-if="!editingSession">
          <div class="flex items-center gap-3 mb-2">
            <SessionTypeBadge :type="session.type" />
            <span class="text-sm text-slate-400">{{ session.day }}</span>
            <span v-if="session.optional" class="text-xs text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
              Optionnel
            </span>
            <button
              @click="openEditSession"
              class="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
              </svg>
              Modifier
            </button>
            <button
              @click="showCopyDrawer = true"
              class="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copier vers…
            </button>
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
        </template>

        <!-- Formulaire d'édition inline -->
        <div v-else class="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3 max-w-lg">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Modifier la séance</span>
            <button @click="editingSession = false" class="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Titre</label>
            <input
              v-model="editTitle"
              type="text"
              @keydown.esc="editingSession = false"
              class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autofocus
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                v-model="editType"
                class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="t in sessionTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">Jour</label>
              <select
                v-model="editDay"
                class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">Durée (min)</label>
              <input
                v-model.number="editDurationMin"
                type="number"
                min="0"
                class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">Intensité (1–10)</label>
              <input
                v-model.number="editIntensityScore"
                type="number"
                min="1"
                max="10"
                class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea
              v-model="editDescription"
              rows="2"
              class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Conseil coach</label>
            <textarea
              v-model="editCoachTip"
              rows="2"
              placeholder="Ex : Garder les talons au sol…"
              class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input v-model="editOptional" type="checkbox" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-slate-600">Séance optionnelle</span>
          </label>

          <div class="flex gap-2 pt-1">
            <button
              @click="saveSession"
              :disabled="!editTitle.trim() || isSavingSession"
              class="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Enregistrer
            </button>
            <button
              @click="editingSession = false"
              class="px-4 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Annuler
            </button>
          </div>
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

      <CopySessionDrawer
        v-if="showCopyDrawer && session && store.currentPlan"
        :session="session"
        :blocks="blocks"
        :plan="store.currentPlan"
        @close="showCopyDrawer = false"
      />
    </template>
  </div>
</template>
