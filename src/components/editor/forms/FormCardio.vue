<script setup lang="ts">
import { reactive } from 'vue'
import type { BlockCardio, PaceZone } from '@/types'

const props = defineProps<{ block: BlockCardio; isSaving: boolean }>()
const emit = defineEmits<{ save: [data: Partial<BlockCardio>]; cancel: [] }>()

const form = reactive<Partial<BlockCardio>>({
  subtype: props.block.subtype,
  duration_min: props.block.duration_min,
  pace_zone: props.block.pace_zone,
  label: props.block.label,
  note: props.block.note,
})

const paceZones: PaceZone[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'threshold', 'race']
const subtypes = ['warmup', 'run', 'cooldown', 'brick_run', 'target_pace']
</script>

<template>
  <form @submit.prevent="emit('save', form)" class="space-y-4">
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Sous-type</label>
      <select v-model="form.subtype" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option v-for="s in subtypes" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Durée (min)</label>
      <input v-model.number="form.duration_min" type="number" @wheel="($event.target as HTMLInputElement).blur()" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Zone de pace</label>
      <select v-model="form.pace_zone" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option value="">—</option>
        <option v-for="z in paceZones" :key="z" :value="z">{{ z }}</option>
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Label</label>
      <input v-model="form.label" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Note</label>
      <textarea v-model="form.note" rows="3" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
    </div>
    <div class="flex gap-3 pt-2">
      <button type="submit" :disabled="isSaving" class="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors">
        {{ isSaving ? 'Sauvegarde…' : 'Sauvegarder' }}
      </button>
      <button type="button" @click="emit('cancel')" class="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
        Annuler
      </button>
    </div>
  </form>
</template>
