<script setup lang="ts">
import { reactive } from 'vue'
import type { BlockStrength } from '@/types'

const props = defineProps<{ block: BlockStrength; isSaving: boolean }>()
const emit = defineEmits<{ save: [data: Partial<BlockStrength>]; cancel: [] }>()

const form = reactive({ rest_sec: props.block.rest_sec, note: props.block.note })
</script>

<template>
  <form @submit.prevent="emit('save', form)" class="space-y-4">
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Repos entre séries (sec)</label>
      <input v-model.number="form.rest_sec" type="number" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Note</label>
      <textarea v-model="form.note" rows="3" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
    </div>
    <p class="text-xs text-slate-400">L'édition des exercices individuels sera disponible prochainement.</p>
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
