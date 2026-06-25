<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAthleteStore } from '@/stores/athletes'
import { useWaitingListStore } from '@/stores/waitingList'
import { usePlanStore } from '@/stores/plan'
import AthleteTable from '@/components/athletes/AthleteTable.vue'
import AthleteDrawer from '@/components/athletes/AthleteDrawer.vue'
import WaitingListTable from '@/components/athletes/WaitingListTable.vue'
import type { AthleteView, WaitingListEntry } from '@/types'

const athleteStore = useAthleteStore()
const waitingListStore = useWaitingListStore()
const planStore = usePlanStore()

type Tab = 'athletes' | 'waiting'
const activeTab = ref<Tab>('athletes')

const drawerOpen = ref(false)
const editingAthlete = ref<AthleteView | null>(null)
const deletingAthlete = ref<AthleteView | null>(null)
const deleteConfirming = ref(false)
const deletingEntry = ref<WaitingListEntry | null>(null)
const deleteEntryConfirming = ref(false)

onMounted(async () => {
  await Promise.all([
    athleteStore.fetchAthletes(),
    waitingListStore.fetchEntries(),
    planStore.plans.length === 0 ? planStore.loadPlans() : Promise.resolve(),
  ])
})

function openAdd() {
  editingAthlete.value = null
  drawerOpen.value = true
}

function openEdit(athlete: AthleteView) {
  editingAthlete.value = athlete
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  editingAthlete.value = null
}

function confirmDelete(athlete: AthleteView) {
  deletingAthlete.value = athlete
}

async function doDelete() {
  if (!deletingAthlete.value) return
  deleteConfirming.value = true
  try {
    await athleteStore.deleteAthlete(deletingAthlete.value)
  } finally {
    deletingAthlete.value = null
    deleteConfirming.value = false
  }
}

function confirmDeleteEntry(entry: WaitingListEntry) {
  deletingEntry.value = entry
}

async function doDeleteEntry() {
  if (!deletingEntry.value) return
  deleteEntryConfirming.value = true
  try {
    await waitingListStore.deleteEntry(deletingEntry.value.id)
  } finally {
    deletingEntry.value = null
    deleteEntryConfirming.value = false
  }
}

function athleteDisplayName(a: AthleteView): string {
  const parts = [a.user.first_name, a.user.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : a.user.email
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
          <span v-if="waitingListStore.entries.length > 0" class="ml-2 text-slate-400">
            · {{ waitingListStore.entries.length }} en attente
          </span>
        </p>
      </div>
      <button
        v-if="activeTab === 'athletes'"
        @click="openAdd"
        class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Ajouter un athlète
      </button>
    </div>

    <!-- Onglets -->
    <div class="px-8 border-b border-slate-200">
      <nav class="flex gap-6">
        <button
          @click="activeTab = 'athletes'"
          class="py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === 'athletes'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-slate-500 hover:text-slate-900'"
        >
          Athlètes
        </button>
        <button
          @click="activeTab = 'waiting'"
          class="py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
          :class="activeTab === 'waiting'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-slate-500 hover:text-slate-900'"
        >
          File d'attente
          <span
            v-if="waitingListStore.entries.length > 0"
            class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold"
            :class="activeTab === 'waiting' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'"
          >
            {{ waitingListStore.entries.length }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Contenu -->
    <div class="px-8 py-6">

      <!-- Onglet Athlètes -->
      <template v-if="activeTab === 'athletes'">
        <div v-if="athleteStore.loading" class="flex justify-center py-12">
          <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <div v-else-if="athleteStore.error" class="text-sm text-red-600 py-4">
          {{ athleteStore.error }}
        </div>
        <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <AthleteTable
            :athletes="athleteStore.athletes"
            @edit="openEdit"
            @delete="confirmDelete"
          />
        </div>
      </template>

      <!-- Onglet File d'attente -->
      <template v-else>
        <div v-if="waitingListStore.loading" class="flex justify-center py-12">
          <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <div v-else-if="waitingListStore.error" class="text-sm text-red-600 py-4">
          {{ waitingListStore.error }}
        </div>
        <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <WaitingListTable
            :entries="waitingListStore.entries"
            @delete="confirmDeleteEntry"
          />
        </div>
      </template>
    </div>

    <!-- Drawer athlète -->
    <AthleteDrawer
      :open="drawerOpen"
      :athlete="editingAthlete"
      @close="closeDrawer"
    />

    <!-- Modale suppression athlète -->
    <Transition name="fade">
      <div v-if="deletingAthlete" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
          <h3 class="text-sm font-semibold text-slate-900 mb-2">Supprimer l'athlète ?</h3>
          <p class="text-sm text-slate-500 mb-5">
            <strong>{{ athleteDisplayName(deletingAthlete) }}</strong> et son compte seront supprimés définitivement.
          </p>
          <div class="flex justify-end gap-3">
            <button @click="deletingAthlete = null"
              class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Annuler
            </button>
            <button @click="doDelete" :disabled="deleteConfirming"
              class="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
              {{ deleteConfirming ? 'Suppression...' : 'Supprimer' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modale suppression file d'attente -->
    <Transition name="fade">
      <div v-if="deletingEntry" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
          <h3 class="text-sm font-semibold text-slate-900 mb-2">Supprimer cette entrée ?</h3>
          <p class="text-sm text-slate-500 mb-5">
            <strong>{{ deletingEntry.email }}</strong> sera supprimé de la file d'attente.
          </p>
          <div class="flex justify-end gap-3">
            <button @click="deletingEntry = null"
              class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Annuler
            </button>
            <button @click="doDeleteEntry" :disabled="deleteEntryConfirming"
              class="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
              {{ deleteEntryConfirming ? 'Suppression...' : 'Supprimer' }}
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
