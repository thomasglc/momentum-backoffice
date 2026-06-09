<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAthleteStore } from '@/stores/athletes'
import { usePlanStore } from '@/stores/plan'
import { useAthleteSchedule } from '@/composables/useAthleteSchedule'
import type { AthleteView } from '@/types'

const props = defineProps<{
  open: boolean
  athlete: AthleteView | null
}>()

const emit = defineEmits<{ close: [] }>()

const athleteStore = useAthleteStore()
const planStore = usePlanStore()
const { scheduleInfo } = useAthleteSchedule()

const saving = ref(false)
const errorMsg = ref<string | null>(null)

const firstName = ref('')
const lastName  = ref('')
const email     = ref('')
const password  = ref('')
const gender    = ref<'homme' | 'femme' | ''>('')
const tenKmMin  = ref('')
const tenKmSec  = ref('')
const planId    = ref<number | null>(null)
const raceDate  = ref('')

const isEdit = computed(() => !!props.athlete)

const availablePlans = computed(() =>
  (planStore.plans ?? []).filter(p => p.status === 'active' || p.status === 'draft')
)

const info = computed(() => {
  if (!raceDate.value) return null
  return scheduleInfo(raceDate.value)
})

const canSave = computed(() => {
  if (!firstName.value.trim() || !email.value.trim()) return false
  if (!isEdit.value && !password.value.trim()) return false
  if (!planId.value) return false
  if (raceDate.value && !(info.value?.valid ?? false)) return false
  return true
})

watch(() => props.athlete, (a) => {
  if (a) {
    firstName.value  = a.user.first_name ?? ''
    lastName.value   = a.user.last_name ?? ''
    email.value      = a.user.email
    password.value   = ''
    gender.value     = (a.profile?.gender as 'homme' | 'femme') ?? ''
    raceDate.value   = a.profile?.race_date ?? ''
    const pid = a.profile?.plan_id
    planId.value     = typeof pid === 'object' ? pid.id : (pid ?? null)
    const secs = a.profile?.ten_km_time_sec
    if (secs) {
      tenKmMin.value = String(Math.floor(secs / 60))
      tenKmSec.value = String(secs % 60).padStart(2, '0')
    } else {
      tenKmMin.value = ''
      tenKmSec.value = ''
    }
  } else {
    firstName.value = ''
    lastName.value  = ''
    email.value     = ''
    password.value  = ''
    gender.value    = ''
    tenKmMin.value  = ''
    tenKmSec.value  = ''
    planId.value    = null
    raceDate.value  = ''
  }
}, { immediate: true })

function parseTenKm(): number | null {
  const m = parseInt(tenKmMin.value)
  const s = parseInt(tenKmSec.value)
  if (isNaN(m) && isNaN(s)) return null
  return (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s)
}

async function save() {
  if (!canSave.value || !planId.value) return
  saving.value = true
  errorMsg.value = null
  try {
    if (props.athlete) {
      await athleteStore.updateAthlete(props.athlete, {
        firstName:    firstName.value.trim(),
        lastName:     lastName.value.trim(),
        email:        email.value.trim(),
        password:     password.value || undefined,
        gender:       (gender.value as 'homme' | 'femme') || null,
        tenKmTimeSec: parseTenKm(),
        planId:       planId.value,
        raceDate:     raceDate.value || null,
      })
    } else {
      await athleteStore.createAthlete({
        firstName:    firstName.value.trim(),
        lastName:     lastName.value.trim(),
        email:        email.value.trim(),
        password:     password.value.trim(),
        gender:       (gender.value as 'homme' | 'femme') || null,
        tenKmTimeSec: parseTenKm(),
        planId:       planId.value,
        raceDate:     raceDate.value || null,
      })
    }
    emit('close')
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorMsg.value = (e as any)?.message ?? 'Erreur lors de la sauvegarde'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 bg-black/20 z-40" @click="emit('close')" />
  </Transition>

  <Transition name="slide">
    <aside v-if="open"
      class="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
        <h2 class="text-sm font-semibold text-slate-900">
          {{ isEdit ? "Modifier l'athlète" : 'Ajouter un athlète' }}
        </h2>
        <button @click="emit('close')" class="p-1 rounded hover:bg-slate-100 transition-colors">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        <!-- Identité -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Identité</h3>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Prénom *</label>
              <input v-model="firstName" type="text" placeholder="Marie"
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nom</label>
              <input v-model="lastName" type="text" placeholder="Dupont"
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Email *</label>
            <input v-model="email" type="email" placeholder="marie@example.com"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Mot de passe {{ isEdit ? '(laisser vide pour ne pas changer)' : '*' }}
            </label>
            <input v-model="password" type="password" placeholder="••••••••"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Genre</label>
            <select v-model="gender"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
              <option value="">Non renseigné</option>
              <option value="homme">Homme</option>
              <option value="femme">Femme</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Temps 10 km</label>
            <div class="flex items-center gap-2">
              <input v-model="tenKmMin" type="number" min="0" max="99" placeholder="45"
                class="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
              <span class="text-sm text-slate-400">min</span>
              <input v-model="tenKmSec" type="number" min="0" max="59" placeholder="00"
                class="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
              <span class="text-sm text-slate-400">sec</span>
            </div>
          </div>
        </div>

        <!-- Plan & Course -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan & Course</h3>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Plan *</label>
            <select v-model="planId"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
              <option :value="null" disabled>Sélectionner un plan...</option>
              <option v-for="plan in availablePlans" :key="plan.id" :value="plan.id">
                {{ plan.title }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Date de course</label>
            <input v-model="raceDate" type="date"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
          </div>

          <div v-if="info" class="px-3 py-2 rounded-lg text-xs"
            :class="info.valid ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'">
            {{ info.message }}
          </div>
        </div>

        <div v-if="errorMsg" class="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {{ errorMsg }}
        </div>
      </div>

      <div class="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
        <button @click="emit('close')"
          class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
          Annuler
        </button>
        <button @click="save" :disabled="!canSave || saving"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          :class="canSave && !saving ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'">
          {{ saving ? 'Sauvegarde...' : (isEdit ? 'Enregistrer' : 'Ajouter') }}
        </button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform 0.25s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
