<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import type { Plan, PlanType } from '@/types'

const store = usePlanStore()
const router = useRouter()

onMounted(() => store.loadPlans())

const statusLabel: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

const statusClasses: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-slate-100 text-slate-400',
}

const planTypeLabel: Record<string, string> = {
  open_solo: 'Open Solo',
  open_double_mixte: 'Open Double Mixte',
  open_double_men: 'Open Double Men',
  open_double_women: 'Open Double Women',
}

// ── Drawer ────────────────────────────────────────────────────────────────────
const drawerOpen = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref(false)
const editingPlan = ref<Plan | null>(null)

const form = reactive({
  title: '',
  description: '' as string,
  sport: '',
  level: '',
  status: '',
  plan_type: '' as PlanType | '',
})

function openDrawer(plan: Plan, e: Event) {
  e.stopPropagation()
  editingPlan.value = plan
  form.title = plan.title
  form.description = plan.description ?? ''
  form.sport = plan.sport
  form.level = plan.level
  form.status = plan.status
  form.plan_type = plan.plan_type ?? ''
  saveError.value = null
  saveSuccess.value = false
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  editingPlan.value = null
}

async function save() {
  if (!editingPlan.value) return
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    await store.updatePlan(editingPlan.value.id, {
      title: form.title,
      description: form.description || null,
      sport: form.sport,
      level: form.level,
      status: form.status,
      plan_type: (form.plan_type as PlanType) || null,
    })
    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
      closeDrawer()
    }, 800)
  } catch {
    saveError.value = 'Erreur lors de la sauvegarde'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-slate-900 mb-6">Plans d'entraînement</h1>

    <div v-if="store.isLoading" class="text-slate-400 text-sm">Chargement…</div>
    <div v-else-if="store.error" class="text-red-500 text-sm">{{ store.error }}</div>

    <div v-else class="grid grid-cols-1 gap-3 max-w-2xl">
      <div
        v-for="plan in store.plans"
        :key="plan.id"
        @click="router.push(`/plans/${plan.id}`)"
        class="group bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-semibold text-slate-900">{{ plan.title }}</h2>
            <p v-if="plan.description" class="text-sm text-slate-500 mt-0.5 truncate">{{ plan.description }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="statusClasses[plan.status] ?? 'bg-slate-100 text-slate-600'"
            >
              {{ statusLabel[plan.status] ?? plan.status }}
            </span>
            <button
              @click="openDrawer(plan, $event)"
              class="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              title="Modifier le plan"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
          <span>{{ plan.sport }}</span>
          <span>Niveau {{ plan.level }}</span>
          <span v-if="plan.plan_type" class="text-indigo-500 font-medium">{{ planTypeLabel[plan.plan_type] ?? plan.plan_type }}</span>
          <span v-if="plan.start_date">Début {{ new Date(plan.start_date).toLocaleDateString('fr-FR') }}</span>
        </div>
      </div>
    </div>

    <!-- Drawer overlay -->
    <Transition name="fade">
      <div
        v-if="drawerOpen"
        class="fixed inset-0 bg-black/20 z-40"
        @click="closeDrawer"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="slide">
      <div
        v-if="drawerOpen"
        class="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 class="font-semibold text-slate-900">Modifier le plan</h2>
          <button @click="closeDrawer" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Form -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Titre</label>
            <input
              v-model="form.title"
              type="text"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea
              v-model="form.description"
              rows="3"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sport</label>
              <input
                v-model="form.sport"
                type="text"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Niveau</label>
              <input
                v-model="form.level"
                type="text"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Statut</label>
            <select
              v-model="form.status"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
            >
              <option value="draft">Brouillon</option>
              <option value="active">Actif</option>
              <option value="archived">Archivé</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type de plan</label>
            <select
              v-model="form.plan_type"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
            >
              <option value="">— Non défini —</option>
              <option value="open_solo">Open Solo</option>
              <option value="open_double_mixte">Open Double Mixte</option>
              <option value="open_double_men">Open Double Men</option>
              <option value="open_double_women">Open Double Women</option>
            </select>
            <p class="mt-1.5 text-xs text-slate-400">Détermine l'affichage des poids Lui/Elle dans l'application mobile.</p>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-200 flex items-center gap-3">
          <button
            @click="save"
            :disabled="saving || !form.title"
            class="flex-1 bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="saving">Sauvegarde…</span>
            <span v-else-if="saveSuccess">Sauvegardé ✓</span>
            <span v-else>Sauvegarder</span>
          </button>
          <button
            @click="closeDrawer"
            class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
        </div>

        <p v-if="saveError" class="px-6 pb-4 text-xs text-red-500">{{ saveError }}</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform 0.25s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
