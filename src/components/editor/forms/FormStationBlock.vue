<script setup lang="ts">
import { reactive } from 'vue'
import type { BlockStationBlock } from '@/types'

const props = defineProps<{ block: BlockStationBlock; isSaving: boolean }>()
const emit = defineEmits<{ save: [data: Partial<BlockStationBlock>]; cancel: [] }>()

const form = reactive({
  brick_format: props.block.brick_format,
  format_note: props.block.format_note,
})
</script>

<template>
  <form @submit.prevent="emit('save', form)" class="space-y-4">
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Format Brick</label>
      <select v-model="form.brick_format" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option value="standard">Standard</option>
        <option value="pyramid">Pyramide</option>
        <option value="follow_the_leader">Follow the Leader</option>
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Note de format</label>
      <textarea v-model="form.format_note" rows="3" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
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
