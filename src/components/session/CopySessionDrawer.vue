<script setup lang="ts">
import { ref, computed } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { fr } from 'date-fns/locale'
import { useDirectus } from '@/composables/useDirectus'
import { usePlanStore } from '@/stores/plan'
import type { Session, Plan, ResolvedBlock } from '@/types'

const props = defineProps<{
  session: Session
  blocks: ResolvedBlock[]
  plan: Plan
}>()

const emit = defineEmits<{ close: [] }>()

const directus = useDirectus()
const store = usePlanStore()
const isCopying = ref(false)
const selectedDate = ref<Date | null>(null)
const selectedWeekNumber = ref<number | null>(null)
const selectedDay = ref<string>('')
const showToast = ref(false)
const toastMsg = ref('')
const toastType = ref<'success' | 'error'>('success')

const hasStartDate = computed(() => !!props.plan.start_date)

const minDate = computed(() => {
  if (!props.plan.start_date) return undefined
  return new Date(props.plan.start_date)
})

const maxDate = computed(() => {
  if (!props.plan.start_date) return undefined
  const d = new Date(props.plan.start_date)
  d.setDate(d.getDate() + 132)
  return d
})

const weekNumbers = computed(() =>
  [...props.plan.weeks].map(w => w.week_number).sort((a, b) => a - b)
)

const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const canCopy = computed(() => {
  if (isCopying.value) return false
  if (hasStartDate.value) return selectedDate.value !== null
  return selectedWeekNumber.value !== null && selectedDay.value !== ''
})

function resolveTarget(): { weekId: number; day: string } | null {
  if (hasStartDate.value && selectedDate.value) {
    const startRaw = new Date(props.plan.start_date!)
    const start = new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate())
    const target = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate())
    const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000)
    const weekNumber = Math.floor(diffDays / 7) + 1
    const week = props.plan.weeks.find(w => w.week_number === weekNumber)
    if (!week) return null
    const dayNames: Record<number, string> = {
      0: 'Dimanche',
      1: 'Lundi',
      2: 'Mardi',
      3: 'Mercredi',
      4: 'Jeudi',
      5: 'Vendredi',
      6: 'Samedi'
    }
    return { weekId: week.id, day: dayNames[selectedDate.value.getDay()] || 'Lundi' }
  }
  if (selectedWeekNumber.value && selectedDay.value) {
    const week = props.plan.weeks.find(w => w.week_number === selectedWeekNumber.value)
    if (!week) return null
    return { weekId: week.id, day: selectedDay.value }
  }
  return null
}

function showToastMessage(msg: string, type: 'success' | 'error') {
  toastMsg.value = msg
  toastType.value = type
  showToast.value = true
  setTimeout(() => (showToast.value = false), 3000)
}

async function handleCopy() {
  const target = resolveTarget()
  if (!target) return
  isCopying.value = true
  try {
    const newSession = await directus.copySession(props.session, props.blocks, target.weekId, target.day)
    const weekInStore = store.currentPlan?.weeks.find(w => w.id === target.weekId)
    if (weekInStore) weekInStore.sessions.push(newSession)
    const targetWeek = props.plan.weeks.find(w => w.id === target.weekId)
    showToastMessage(`Séance copiée → Semaine ${targetWeek?.week_number} — ${target.day}`, 'success')
    setTimeout(() => emit('close'), 1500)
  } catch {
    showToastMessage('Erreur lors de la copie', 'error')
  } finally {
    isCopying.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black/20" @click="emit('close')" />

  <div class="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-white shadow-xl border-l border-slate-200 flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
      <h2 class="font-semibold text-slate-900">Copier vers…</h2>
      <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      <template v-if="hasStartDate">
        <p class="text-sm text-slate-500">Choisissez une date dans le plan :</p>
        <VueDatePicker
          v-model="selectedDate"
          :min-date="minDate"
          :max-date="maxDate"
          inline
          auto-apply
          :enable-time-picker="false"
          :locale="fr"
          :week-start="1"
        />
      </template>

      <template v-else>
        <p class="text-sm text-slate-500">Ce plan n'a pas de date de début. Choisissez manuellement :</p>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Semaine</label>
          <select
            v-model="selectedWeekNumber"
            class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option :value="null" disabled>Choisir une semaine</option>
            <option v-for="n in weekNumbers" :key="n" :value="n">Semaine {{ n }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Jour</label>
          <select
            v-model="selectedDay"
            class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="" disabled>Choisir un jour</option>
            <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
      </template>
    </div>

    <div class="px-6 py-4 border-t border-slate-200 flex gap-2">
      <button
        @click="handleCopy"
        :disabled="!canCopy"
        class="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
      >
        <span v-if="isCopying">Copie en cours…</span>
        <span v-else>Copier</span>
      </button>
      <button
        @click="emit('close')"
        class="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
      >
        Annuler
      </button>
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
