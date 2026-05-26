<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="block in blocks"
      :key="block.meta.id"
      class="group relative"
    >
      <component
        :is="blockComponents[block.meta.block_type]"
        :block="block.data as any"
      />
      <button
        v-if="onEdit"
        @click="onEdit(block)"
        class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs text-slate-500 border border-slate-200 rounded hover:bg-slate-50"
      >
        Modifier
      </button>
    </div>
  </div>
</template>
