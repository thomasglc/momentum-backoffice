<script setup lang="ts">
import { reactive } from 'vue'
import type { BlockCircuit } from '@/types'

const props = defineProps<{ block: BlockCircuit; isSaving: boolean }>()
const emit = defineEmits<{ save: [data: Partial<BlockCircuit>]; cancel: [] }>()

const form = reactive({
  label: props.block.label,
  format: props.block.format,
  rounds: props.block.rounds,
  duration_min: props.block.duration_min,
  rest_between_min: props.block.rest_between_min,
  note: props.block.note,
})
</script>

<template>
  <form @submit.prevent="emit('save', form)" class="space-y-4">
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Label</label>
      <input v-model="form.label" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Format</label>
      <select v-model="form.format" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option value="rounds">Rounds</option>
        <option value="time">Temps</option>
        <option value="amrap">AMRAP</option>
      </select>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Rounds</label>
        <input v-model.number="form.rounds" type="number" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Durée (min)</label>
        <input v-model.number="form.duration_min" type="number" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Repos (min)</label>
        <input v-model.number="form.rest_between_min" type="number" step="0.5" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
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
