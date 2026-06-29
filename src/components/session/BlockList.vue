<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ResolvedBlock } from '@/types'
import BlockCardio from './blocks/BlockCardio.vue'
import BlockIntervals from './blocks/BlockIntervals.vue'
import BlockStrength from './blocks/BlockStrength.vue'
import BlockCircuit from './blocks/BlockCircuit.vue'
import BlockMiniRace from './blocks/BlockMiniRace.vue'
import BlockStationActivation from './blocks/BlockStationActivation.vue'
import BlockStationBlock from './blocks/BlockStationBlock.vue'

const props = defineProps<{
  blocks: ResolvedBlock[]
  onEdit?: (block: ResolvedBlock) => void
  onDelete?: (block: ResolvedBlock) => void
}>()

const emit = defineEmits<{
  reorder: [blocks: ResolvedBlock[]]
}>()

const blockComponents = {
  block_cardio: BlockCardio,
  block_intervals: BlockIntervals,
  block_strength: BlockStrength,
  block_circuit: BlockCircuit,
  block_mini_race: BlockMiniRace,
  block_station_activation: BlockStationActivation,
  block_station_block: BlockStationBlock,
}

// ── Suppression (existant) ───────────────────────────────────────────────────
const pendingDeleteId = ref<number | null>(null)
let cancelTimer: ReturnType<typeof setTimeout> | null = null

function requestDelete(block: ResolvedBlock) {
  pendingDeleteId.value = block.meta.id
  cancelTimer = setTimeout(() => { pendingDeleteId.value = null }, 3000)
}

function cancelDelete() {
  pendingDeleteId.value = null
  if (cancelTimer) clearTimeout(cancelTimer)
}

function confirmDelete(block: ResolvedBlock) {
  if (cancelTimer) clearTimeout(cancelTimer)
  pendingDeleteId.value = null
  props.onDelete?.(block)
}

// ── Drag & Drop ──────────────────────────────────────────────────────────────
const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const dragPosition = ref<'before' | 'after'>('after')

// Position d'insertion dans le tableau original (0-based, entre les blocs)
const insertIndex = computed(() => {
  if (dragOverIndex.value === null || draggingIndex.value === null) return null
  return dragPosition.value === 'before' ? dragOverIndex.value : dragOverIndex.value + 1
})

function onDragStart(index: number) {
  draggingIndex.value = index
}

function onDragEnd() {
  draggingIndex.value = null
  dragOverIndex.value = null
}

function onDragOver(e: DragEvent, index: number) {
  if (draggingIndex.value === null) return
  dragOverIndex.value = index
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dragPosition.value = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

function onDragLeave(index: number) {
  if (dragOverIndex.value === index) dragOverIndex.value = null
}

function onDrop() {
  const from = draggingIndex.value
  const to = insertIndex.value

  onDragEnd()

  if (from === null || to === null) return
  // Pas de mouvement : drop juste avant ou juste après soi-même
  if (to === from || to === from + 1) return

  const newBlocks = [...props.blocks]
  const moved = newBlocks.splice(from, 1)[0]
  if (!moved) return
  // Après suppression de `from`, l'index cible décale si to > from
  const adjustedTo = to > from ? to - 1 : to
  newBlocks.splice(adjustedTo, 0, moved)

  emit('reorder', newBlocks)
}
</script>

<template>
  <div>
    <div
      v-for="(block, index) in blocks"
      :key="block.meta.id"
    >
      <!-- Indicateur de drop AVANT ce bloc -->
      <div
        class="h-0.5 rounded-full transition-all mb-2"
        :class="insertIndex === index && draggingIndex !== index ? 'bg-indigo-400' : 'bg-transparent'"
      />

      <div
        class="group relative mb-3"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragend="onDragEnd"
        @dragover.prevent="onDragOver($event, index)"
        @dragleave="onDragLeave(index)"
        @drop.prevent="onDrop()"
        @click="pendingDeleteId === block.meta.id ? null : onEdit?.(block)"
        :class="[
          onEdit && pendingDeleteId !== block.meta.id
            ? 'cursor-pointer hover:ring-2 hover:ring-indigo-300 rounded-xl transition-shadow'
            : 'rounded-xl',
          draggingIndex === index ? 'opacity-50' : '',
        ]"
      >
        <!-- Handle drag (6 points, visible au hover, gauche) -->
        <div
          class="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-all select-none z-10"
          title="Déplacer"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9"  cy="5"  r="1.5"/>
            <circle cx="15" cy="5"  r="1.5"/>
            <circle cx="9"  cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9"  cy="19" r="1.5"/>
            <circle cx="15" cy="19" r="1.5"/>
          </svg>
        </div>

        <component
          :is="blockComponents[block.meta.block_type]"
          :block="block.data as any"
        />

        <!-- Icône suppression (état normal) -->
        <button
          v-if="onDelete && pendingDeleteId !== block.meta.id"
          @click.stop="requestDelete(block)"
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Supprimer ce bloc"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        <!-- Confirmation suppression -->
        <div
          v-if="onDelete && pendingDeleteId === block.meta.id"
          @click.stop
          class="absolute inset-0 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center gap-3"
        >
          <span class="text-sm text-slate-600">Supprimer ce bloc ?</span>
          <button
            @click.stop="confirmDelete(block)"
            class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Supprimer
          </button>
          <button
            @click.stop="cancelDelete()"
            class="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>

    <!-- Indicateur de drop APRÈS le dernier bloc -->
    <div
      class="h-0.5 rounded-full transition-all"
      :class="insertIndex === blocks.length && draggingIndex !== null ? 'bg-indigo-400' : 'bg-transparent'"
    />
  </div>
</template>
