<script setup lang="ts">
import { ref } from 'vue'
import { useDirectus } from '@/composables/useDirectus'
import type { ResolvedBlock } from '@/types'
import FormCardio from './forms/FormCardio.vue'
import FormIntervals from './forms/FormIntervals.vue'
import FormStrength from './forms/FormStrength.vue'
import FormCircuit from './forms/FormCircuit.vue'
import FormMiniRace from './forms/FormMiniRace.vue'
import FormStationActivation from './forms/FormStationActivation.vue'
import FormStationBlock from './forms/FormStationBlock.vue'

const props = defineProps<{ block: ResolvedBlock }>()
const emit = defineEmits<{ close: [] }>()

const directus = useDirectus()

const isSaving = ref(false)
const toastMsg = ref('')
const toastType = ref<'success' | 'error'>('success')
const showToast = ref(false)

const formComponents = {
  block_cardio: FormCardio,
  block_intervals: FormIntervals,
  block_strength: FormStrength,
  block_circuit: FormCircuit,
  block_mini_race: FormMiniRace,
  block_station_activation: FormStationActivation,
  block_station_block: FormStationBlock,
} as const

async function handleSave(data: Record<string, unknown>) {
  isSaving.value = true
  try {
    await directus.updateBlock(props.block.meta.block_type, props.block.meta.block_id, data)
    showToastMessage('Sauvegardé', 'success')
    emit('close')
  } catch (err) {
    console.error('Error saving block:', err)
    showToastMessage('Erreur lors de la sauvegarde', 'error')
  } finally {
    isSaving.value = false
  }
}

function showToastMessage(msg: string, type: 'success' | 'error') {
  toastMsg.value = msg
  toastType.value = type
  showToast.value = true
  setTimeout(() => (showToast.value = false), 3000)
}
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black/20" @click="emit('close')" />

  <div class="fixed right-0 top-0 bottom-0 z-50 w-[480px] bg-white shadow-xl border-l border-slate-200 flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
      <h2 class="font-semibold text-slate-900 capitalize">
        Modifier {{ block.meta.block_type.replace('block_', '').replace(/_/g, ' ') }}
      </h2>
      <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5">
      <component
        :is="(formComponents as any)[block.meta.block_type]"
        :block="(block.data as any)"
        :is-saving="isSaving"
        @save="handleSave"
        @cancel="emit('close')"
      />
    </div>
  </div>

  <Transition
    enter-from-class="opacity-0 translate-y-2"
    enter-active-class="transition duration-200"
    leave-to-class="opacity-0"
    leave-active-class="transition duration-200"
  >
    <div
      v-if="showToast"
      class="fixed bottom-4 right-4 z-[60] px-4 py-3 rounded-lg shadow text-sm font-medium text-white"
      :class="toastType === 'success' ? 'bg-emerald-500' : 'bg-red-500'"
    >
      {{ toastMsg }}
    </div>
  </Transition>
</template>
