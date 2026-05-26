<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import type { BlockStationActivation, StationCatalog } from '@/types'
import { useDirectus } from '@/composables/useDirectus'
import StationList from '../StationList.vue'

const props = defineProps<{ block: BlockStationActivation; isSaving: boolean }>()
const emit = defineEmits<{
  save: [payload: { _block: Partial<BlockStationActivation>; _itemOps: ReturnType<InstanceType<typeof StationList>['getOps']> }]
  cancel: []
}>()

const directus = useDirectus()
const catalog = ref<StationCatalog[]>([])
const stationListRef = ref<InstanceType<typeof StationList> | null>(null)

const form = reactive({ rounds: props.block.rounds, note: props.block.note })

onMounted(async () => {
  catalog.value = (await directus.fetchStationCatalog()) as StationCatalog[]
})

function handleSubmit() {
  emit('save', {
    _block: { ...form },
    _itemOps: stationListRef.value!.getOps(),
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Rounds</label>
      <input v-model.number="form.rounds" type="number"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Note</label>
      <textarea v-model="form.note" rows="2"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Stations</span>
        <span v-if="catalog.length === 0" class="text-xs text-slate-400">Chargement…</span>
      </div>
      <StationList
        ref="stationListRef"
        :initial-stations="block.stations ?? []"
        :catalog="catalog"
        :block-id="block.id"
        child-collection="block_station_activation_entries"
        parent-key="block_station_activation_id"
      />
    </div>

    <div class="flex gap-3 pt-2">
      <button type="submit" :disabled="isSaving"
        class="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors">
        {{ isSaving ? 'Sauvegarde…' : 'Sauvegarder' }}
      </button>
      <button type="button" @click="emit('cancel')"
        class="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
        Annuler
      </button>
    </div>
  </form>
</template>
