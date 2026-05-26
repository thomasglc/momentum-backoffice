<script setup lang="ts">
import { ref } from 'vue'
import type { ResolvedBlock } from '@/types'
import BlockCardio from './blocks/BlockCardio.vue'
import BlockIntervals from './blocks/BlockIntervals.vue'
import BlockStrength from './blocks/BlockStrength.vue'
import BlockCircuit from './blocks/BlockCircuit.vue'
import BlockMiniRace from './blocks/BlockMiniRace.vue'
import BlockStationActivation from './blocks/BlockStationActivation.vue'
import BlockStationBlock from './blocks/BlockStationBlock.vue'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = defineProps<{
  blocks: ResolvedBlock[]
  onEdit?: (block: ResolvedBlock) => void
  onDelete?: (block: ResolvedBlock) => void
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
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="block in blocks"
      :key="block.meta.id"
      class="group relative"
      @click="pendingDeleteId === block.meta.id ? null : onEdit?.(block)"
      :class="onEdit && pendingDeleteId !== block.meta.id ? 'cursor-pointer hover:ring-2 hover:ring-indigo-300 rounded-xl transition-shadow' : 'rounded-xl'"
    >
      <component
        :is="blockComponents[block.meta.block_type]"
        :block="block.data as any"
      />

      <!-- État normal : icône corbeille au survol -->
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

      <!-- État confirmation -->
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
</template>
