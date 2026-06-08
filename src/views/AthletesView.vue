<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAthleteStore } from '@/stores/athletes'
import { usePlanStore } from '@/stores/plan'
import AthleteTable from '@/components/athletes/AthleteTable.vue'
import AthleteDrawer from '@/components/athletes/AthleteDrawer.vue'
import type { AthleteWithAssignment } from '@/types'

const athleteStore = useAthleteStore()
const planStore = usePlanStore()

const drawerOpen = ref(false)
const editingAthlete = ref<AthleteWithAssignment | null>(null)
const deletingAthlete = ref<AthleteWithAssignment | null>(null)
const deleteConfirming = ref(false)

onMounted(async () => {
  await Promise.all([
    athleteStore.fetchAthletes(),
    planStore.plans.length === 0 ? planStore.loadPlans() : Promise.resolve(),
  ])
})

function openAdd() {
  editingAthlete.value = null
  drawerOpen.value = true
}

function openEdit(athlete: AthleteWithAssignment) {
  editingAthlete.value = athlete
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  editingAthlete.value = null
}

async function confirmDelete(athlete: AthleteWithAssignment) {
  deletingAthlete.value = athlete
}

async function doDelete() {
  if (!deletingAthlete.value) return
  deleteConfirming.value = true
  try {
    await athleteStore.deleteAthlete(deletingAthlete.value.id)
  } finally {
    deletingAthlete.value = null
    deleteConfirming.value = false
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Header -->
    <div class="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-900">Athlètes</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          {{ athleteStore.athletes.length }} athlète{{ athleteStore.athletes.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <button
        @click="openAdd"
        class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Ajouter un athlète
      </button>
    </div>

    <!-- Contenu -->
    <div class="px-8 py-6">
      <!-- Loading -->
      <div v-if="athleteStore.loading" class="flex justify-center py-12">
        <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>

      <!-- Erreur -->
      <div v-else-if="athleteStore.error" class="text-sm text-red-600 py-4">
        {{ athleteStore.error }}
      </div>

      <!-- Tableau -->
      <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <AthleteTable
          :athletes="athleteStore.athletes"
          @edit="openEdit"
          @delete="confirmDelete"
        />
      </div>
    </div>

    <!-- Drawer -->
    <AthleteDrawer
      :open="drawerOpen"
      :athlete="editingAthlete"
      @close="closeDrawer"
    />

    <!-- Modal de confirmation de suppression -->
    <Transition name="fade">
      <div v-if="deletingAthlete" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
          <h3 class="text-sm font-semibold text-slate-900 mb-2">Supprimer l'athlète ?</h3>
          <p class="text-sm text-slate-500 mb-5">
            <strong>{{ deletingAthlete.name }}</strong> et toutes ses affectations seront supprimés définitivement.
          </p>
          <div class="flex justify-end gap-3">
            <button
              @click="deletingAthlete = null"
              class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Annuler
            </button>
            <button
              @click="doDelete"
              :disabled="deleteConfirming"
              class="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {{ deleteConfirming ? 'Suppression...' : 'Supprimer' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
