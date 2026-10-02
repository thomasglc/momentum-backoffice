<script setup lang="ts">
import type { DayState } from '@/utils/progress'

defineProps<{ days: DayState[] }>()

const STATE_LABEL: Record<DayState['state'], string> = {
  done: 'validée',
  todo: 'à faire',
  late: 'à rattraper',
  rest: 'repos',
  bonus: 'optionnelle',
}

function describe(day: DayState): string {
  if (!day.sessions.length) return `${day.day} : repos`
  return `${day.day} : ${day.sessions.map(s => s.title).join(', ')} — ${STATE_LABEL[day.state]}`
}

function dotClass(day: DayState): string {
  if (day.state === 'done') return 'bg-emerald-500 text-white'
  if (day.state === 'late') return 'border-2 border-amber-400 bg-amber-50'
  if (day.state === 'bonus') return 'border border-dashed border-slate-300'
  return day.isToday ? 'border-2 border-indigo-500' : 'border-2 border-slate-200'
}
</script>

<template>
  <!-- La semaine en sept points, du lundi au dimanche -->
  <ol class="flex items-center gap-1" :aria-label="days.map(describe).join(' ; ')">
    <li v-for="day in days" :key="day.day" :title="describe(day)" class="flex flex-col items-center gap-0.5">
      <span class="text-xs leading-none font-medium" :class="day.isToday ? 'text-indigo-600' : 'text-slate-400'">{{ day.letter }}</span>
      <span v-if="day.state === 'rest'" class="w-5 h-5 flex items-center justify-center">
        <span class="w-1 h-1 rounded-full bg-slate-300" />
      </span>
      <span v-else class="w-5 h-5 rounded-full flex items-center justify-center" :class="dotClass(day)">
        <svg v-if="day.state === 'done'" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    </li>
  </ol>
</template>
