<script setup lang="ts">
import type { Session } from '@/types'
import SessionTypeBadge from '@/components/ui/SessionTypeBadge.vue'
import IntensityBar from '@/components/ui/IntensityBar.vue'

defineProps<{ session: Session; planId: number }>()

const sessionColorBorder: Record<string, string> = {
  running:  'border-l-blue-400',
  hyrox:    'border-l-orange-400',
  brick:    'border-l-amber-400',
  strength: 'border-l-violet-400',
  mobility: 'border-l-emerald-400',
  recovery: 'border-l-slate-300',
  race:     'border-l-red-400',
}
</script>

<template>
  <RouterLink
    :to="`/plans/${planId}/sessions/${session.id}`"
    class="block bg-white border border-slate-200 border-l-4 rounded-lg p-3 hover:shadow-sm hover:border-slate-300 transition-all"
    :class="sessionColorBorder[session.type]"
  >
    <div class="flex items-start justify-between gap-1 mb-1.5">
      <SessionTypeBadge :type="session.type" />
      <span v-if="session.optional" class="text-xs text-slate-400">Optionnel</span>
    </div>
    <p class="text-sm font-medium text-slate-800 leading-snug">{{ session.title }}</p>
    <div class="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
      <span v-if="session.duration_min">{{ session.duration_min }} min</span>
    </div>
    <IntensityBar v-if="session.intensity_score" :score="session.intensity_score" class="mt-2" />
  </RouterLink>
</template>
