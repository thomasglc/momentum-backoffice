<script setup lang="ts">
import type { SessionType } from '@/types'

const props = defineProps<{ type: SessionType }>()

const config: Record<SessionType, { label: string; classes: string }> = {
  running:  { label: 'Course',    classes: 'bg-blue-100 text-blue-700' },
  hyrox:    { label: 'Hyrox',     classes: 'bg-orange-100 text-orange-700' },
  brick:    { label: 'Brick',     classes: 'bg-amber-100 text-amber-700' },
  strength: { label: 'Muscu',     classes: 'bg-violet-100 text-violet-700' },
  mobility: { label: 'Mobilité',  classes: 'bg-emerald-100 text-emerald-700' },
  recovery: { label: 'Récup',     classes: 'bg-slate-100 text-slate-600' },
  race:     { label: 'Race',      classes: 'bg-red-100 text-red-700' },
}
</script>

<template>
  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="config[props.type].classes">
    {{ config[props.type].label }}
  </span>
</template>
