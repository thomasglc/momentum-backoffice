<script setup lang="ts">
import type { BlockCardio } from '@/types'
import PaceZoneBadge from '@/components/ui/PaceZoneBadge.vue'

defineProps<{ block: BlockCardio }>()

const subtypeLabel: Record<string, string> = {
  warmup: 'ÉCHAUFFEMENT',
  run: 'COURSE',
  cooldown: 'RETOUR AU CALME',
  brick_run: 'BRICK RUN',
  target_pace: 'ALLURE CIBLE',
}

const subtypeIcon: Record<string, string> = {
  warmup: '🔥', run: '🏃', cooldown: '❄️', brick_run: '⚡', target_pace: '🎯',
}
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
      <span>{{ subtypeIcon[block.subtype] }}</span>
      <span>{{ subtypeLabel[block.subtype] ?? block.subtype }}</span>
      <span v-if="block.duration_min" class="text-slate-400 font-normal normal-case">· {{ block.duration_min }} min</span>
      <PaceZoneBadge v-if="block.pace_zone" :zone="block.pace_zone" />
    </div>
    <p v-if="block.label" class="text-sm text-slate-700 font-medium">{{ block.label }}</p>
    <p v-if="block.note" class="text-xs text-slate-400 mt-1 italic">{{ block.note }}</p>
  </div>
</template>
