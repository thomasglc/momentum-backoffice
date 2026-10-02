<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import AppToast from '@/components/ui/AppToast.vue'
import type { Plan, PlanType } from '@/types'

const store = usePlanStore()
const router = useRouter()
const toast = ref<InstanceType<typeof AppToast> | null>(null)

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

// ── Drawer : modification d'un plan, ou création quand editingPlan est vide ───
const PHASES = [1, 2, 3, 4]
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
  total_weeks: '' as number | '',
  phase_names: {} as Record<number, string>,
})

function fillForm(plan: Plan | null) {
  const model = store.plans[0] // un nouveau plan reprend le sport et le niveau des plans existants
  form.title = plan?.title ?? ''
  form.description = plan?.description ?? ''
  form.sport = plan?.sport ?? model?.sport ?? 'hyrox'
  form.level = plan?.level ?? model?.level ?? ''
  form.status = plan?.status ?? 'draft'
  form.plan_type = plan?.plan_type ?? ''
  form.total_weeks = plan ? plan.total_weeks ?? '' : 19
  form.phase_names = Object.fromEntries(PHASES.map(phase => [phase, plan?.phase_names?.[phase] ?? '']))
  saveError.value = null
  saveSuccess.value = false
}

function openDrawer(plan: Plan, e: Event) {
  e.stopPropagation()
  editingPlan.value = plan
  fillForm(plan)
  drawerOpen.value = true
}

function openCreate() {
  editingPlan.value = null
  fillForm(null)
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  editingPlan.value = null
}

async function save() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  const names = Object.fromEntries(
    PHASES.map(phase => [String(phase), (form.phase_names[phase] ?? '').trim()]).filter(([, name]) => name)
  )
  const data = {
    title: form.title.trim(),
    description: form.description || null,
    sport: form.sport,
    level: form.level,
    status: form.status,
    plan_type: (form.plan_type as PlanType) || null,
    total_weeks: form.total_weeks === '' ? null : Number(form.total_weeks),
    phase_names: Object.keys(names).length ? names : null,
  }
  try {
    if (editingPlan.value) {
      await store.updatePlan(editingPlan.value.id, data)
      saveSuccess.value = true
      setTimeout(() => {
        saveSuccess.value = false
        closeDrawer()
      }, 800)
    } else {
      // Un plan créé n'a pas encore de semaine : on ouvre sa page pour les ajouter
      const created = await store.createPlan(data)
      closeDrawer()
      router.push(`/plans/${created.id}`)
    }
  } catch {
    saveError.value = 'Erreur lors de la sauvegarde'
  } finally {
    saving.value = false
  }
}

// ── Duplication d'un plan ────────────────────────────────────────────────────
const copying = ref<{ planId: number; done: number; total: number } | null>(null)

async function duplicate(plan: Plan, e: Event) {
  e.stopPropagation()
  if (copying.value) return
  copying.value = { planId: plan.id, done: 0, total: 0 }
  try {
    await store.duplicatePlan(plan, (done, total) => { copying.value = { planId: plan.id, done, total } })
    toast.value?.show(`« ${plan.title} » dupliqué en brouillon`)
  } catch (error) {
    toast.value?.show(error instanceof Error ? error.message : 'Copie du plan interrompue', 'error')
  } finally {
    copying.value = null
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6 max-w-2xl">
      <h1 class="text-xl font-semibold text-slate-900">Plans d'entraînement</h1>
      <button
        @click="openCreate"
        class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Nouveau plan
      </button>
    </div>

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
              @click="duplicate(plan, $event)"
              :disabled="copying !== null"
              class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-0"
              title="Dupliquer le plan"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </button>
            <button
              @click="openDrawer(plan, $event)"
              class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
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
          <span v-if="plan.total_weeks">{{ plan.total_weeks }} semaines</span>
          <span v-if="plan.start_date">Début {{ new Date(plan.start_date).toLocaleDateString('fr-FR') }}</span>
        </div>

        <!-- Copie en cours : où elle en est -->
        <p v-if="copying?.planId === plan.id" role="status" class="mt-3 text-xs font-medium text-indigo-600">
          Copie en cours…
          <template v-if="copying.total">semaine {{ Math.min(copying.done + 1, copying.total) }} sur {{ copying.total }}</template>
        </p>
      </div>

      <p v-if="store.plans.length === 0" class="text-sm text-slate-400 py-8 text-center">
        Aucun plan — clique sur « Nouveau plan » pour commencer.
      </p>
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
          <h2 class="font-semibold text-slate-900">{{ editingPlan ? 'Modifier le plan' : 'Nouveau plan' }}</h2>
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

          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Durée du plan (semaines)</label>
            <input
              v-model.number="form.total_weeks"
              type="number"
              min="1"
              max="60"
              class="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
            <p class="mt-1.5 text-xs text-slate-400">Course comprise. La semaine de chaque athlète se calcule depuis sa date de course et cette durée.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Noms des phases</label>
            <div class="grid grid-cols-2 gap-2">
              <input
                v-for="phase in PHASES"
                :key="phase"
                v-model="form.phase_names[phase]"
                type="text"
                :placeholder="`Phase ${phase}`"
                :aria-label="`Nom de la phase ${phase}`"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <p class="mt-1.5 text-xs text-slate-400">Affichés dans l'application à la place des noms par défaut.</p>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-200 flex items-center gap-3">
          <button
            @click="save"
            :disabled="saving || !form.title.trim()"
            class="flex-1 bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="saving">Sauvegarde…</span>
            <span v-else-if="saveSuccess">Sauvegardé ✓</span>
            <span v-else>{{ editingPlan ? 'Sauvegarder' : 'Créer le plan' }}</span>
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

    <AppToast ref="toast" />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform 0.25s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
