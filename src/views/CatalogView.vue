<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '@/stores/catalog'
import type { CatalogEntry, CatalogKind } from '@/stores/catalog'
import { CATEGORIES, EQUIPMENT, MEASUREMENTS, labelOf } from '@/constants/catalog'
import { matchesText, usageLabel } from '@/utils/catalog'
import type { Usage } from '@/utils/catalog'
import CatalogDrawer from '@/components/catalog/CatalogDrawer.vue'
import AppToast from '@/components/ui/AppToast.vue'

const store = useCatalogStore()
const route = useRoute()
const router = useRouter()
const toast = ref<InstanceType<typeof AppToast> | null>(null)

onMounted(() => store.load())

// L'onglet est dans l'adresse : un rechargement y revient
const kind = computed<CatalogKind>(() => (route.query.onglet === 'stations' ? 'station' : 'exercise'))
const search = ref('')
function showTab(next: CatalogKind) {
  search.value = '' // le filtre d'un onglet n'a pas de sens dans l'autre
  router.replace({ query: next === 'station' ? { onglet: 'stations' } : {} })
}

const exercises = computed(() => store.exercises.filter(entry => matchesText(entry.name, search.value)))
const stations = computed(() => store.stations.filter(entry => matchesText(entry.name, search.value)))

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
const summary = computed(() => {
  const all: CatalogEntry[] = kind.value === 'exercise' ? store.exercises : store.stations
  const bare = all.filter(entry => !entry.image_urls?.length).length
  return [
    kind.value === 'exercise' ? plural(all.length, 'exercice', 'exercices') : plural(all.length, 'station', 'stations'),
    bare ? `${bare} sans photo` : '',
  ].filter(Boolean).join(' · ')
})

// ── Utilisations ─────────────────────────────────────────────────────────────
const usageText = (usage: Usage | null) => (store.usageStatus === 'loading' ? '…' : usageLabel(usage))
const usageTitle = (usage: Usage | null) =>
  (usage ? `${usage.planned} dans les séances des plans · ${usage.logged} dans les saisies d'athlètes` : '')

// ── Tiroir : modification d'une entrée, ou création quand entry est vide ─────
const editing = ref<{ kind: CatalogKind; entry: CatalogEntry | null } | null>(null)
const open = (entry: CatalogEntry | null) => { editing.value = { kind: kind.value, entry } }
const close = () => { editing.value = null }

function done(message: string) {
  close()
  toast.value?.show(message)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Catalogue</h1>
        <p v-if="store.status === 'ready'" class="text-sm text-slate-500 mt-0.5">{{ summary }}</p>
      </div>
      <button
        v-if="store.status === 'ready'"
        type="button"
        class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        @click="open(null)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ kind === 'exercise' ? 'Nouvel exercice' : 'Nouvelle station' }}
      </button>
    </div>

    <div v-if="store.status === 'idle' || store.status === 'loading'" class="text-slate-400 text-sm">Chargement…</div>

    <div v-else-if="store.status === 'error'" role="alert" class="flex items-center gap-3 text-sm text-red-600">
      Catalogue indisponible pour le moment.
      <button type="button" class="font-medium underline" @click="store.load()">Réessayer</button>
    </div>

    <template v-else>
      <div class="flex items-end justify-between gap-4 border-b border-slate-200 mb-4">
        <nav class="flex gap-6">
          <button
            v-for="tab in (['exercise', 'station'] as const)"
            :key="tab"
            type="button"
            class="py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            :class="kind === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'"
            :aria-current="kind === tab ? 'page' : undefined"
            @click="showTab(tab)"
          >
            {{ tab === 'exercise' ? 'Exercices' : 'Stations' }}
            <span
              class="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-semibold tabular-nums"
              :class="kind === tab ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'"
            >{{ tab === 'exercise' ? store.exercises.length : store.stations.length }}</span>
          </button>
        </nav>
        <input
          v-model="search"
          type="search"
          placeholder="Filtrer par nom"
          aria-label="Filtrer par nom"
          class="mb-2 w-56 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      <p
        v-if="store.usageStatus === 'error'"
        role="alert"
        class="mb-3 px-3 py-2 rounded-lg border border-amber-100 bg-amber-50 text-xs text-amber-700"
      >
        Décompte des utilisations indisponible : rien ne se supprime tant qu'il manque.
        <button type="button" class="font-medium underline" @click="store.load()">Réessayer</button>
      </p>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <!-- Exercices -->
        <table v-if="kind === 'exercise'" class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th class="pl-4 py-3 w-16"><span class="sr-only">Photo</span></th>
              <th class="px-4 py-3">Exercice</th>
              <th class="px-4 py-3">Catégorie</th>
              <th class="px-4 py-3">Matériel</th>
              <th class="px-4 py-3">Note</th>
              <th class="px-4 py-3">Utilisé</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="entry in exercises" :key="entry.id" class="cursor-pointer hover:bg-slate-50 transition-colors" @click="open(entry)">
              <td class="pl-4 py-1.5">
                <img v-if="entry.image_urls?.length" :src="entry.image_urls[0]" alt="" loading="lazy" class="h-9 w-12 rounded bg-slate-100 object-cover" />
                <span v-else class="flex h-9 w-12 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400" title="Sans photo">—</span>
              </td>
              <td class="px-4 py-1.5">
                <button type="button" class="font-medium text-slate-900 whitespace-nowrap hover:text-indigo-600" @click.stop="open(entry)">{{ entry.name }}</button>
              </td>
              <td class="px-4 py-1.5 text-slate-600 whitespace-nowrap">{{ labelOf(CATEGORIES, entry.category) || '—' }}</td>
              <td class="px-4 py-1.5 text-slate-600 whitespace-nowrap">{{ labelOf(EQUIPMENT, entry.equipment) || '—' }}</td>
              <td class="px-4 py-1.5 text-slate-500"><span class="block max-w-80 truncate" :title="entry.notes ?? ''">{{ entry.notes }}</span></td>
              <td
                class="px-4 py-1.5 whitespace-nowrap tabular-nums"
                :class="store.usageOf('exercise', entry.id)?.planned ? 'text-slate-600' : 'text-slate-400'"
                :title="usageTitle(store.usageOf('exercise', entry.id))"
              >{{ usageText(store.usageOf('exercise', entry.id)) }}</td>
            </tr>
            <tr v-if="exercises.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-sm text-slate-400">
                {{ search ? `Aucun exercice ne correspond à « ${search} ».` : 'Aucun exercice pour le moment.' }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Stations -->
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th class="pl-4 py-3 w-16"><span class="sr-only">Photo</span></th>
              <th class="px-4 py-3">Station</th>
              <th class="px-4 py-3">Mesure</th>
              <th class="px-4 py-3">Note</th>
              <th class="px-4 py-3">Utilisée</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="entry in stations" :key="entry.id" class="cursor-pointer hover:bg-slate-50 transition-colors" @click="open(entry)">
              <td class="pl-4 py-1.5">
                <img v-if="entry.image_urls?.length" :src="entry.image_urls[0]" alt="" loading="lazy" class="h-9 w-12 rounded bg-slate-100 object-cover" />
                <span v-else class="flex h-9 w-12 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400" title="Sans photo">—</span>
              </td>
              <td class="px-4 py-1.5">
                <span class="flex items-center gap-2">
                  <button type="button" class="font-medium text-slate-900 whitespace-nowrap hover:text-indigo-600" @click.stop="open(entry)">{{ entry.name }}</button>
                  <span v-if="entry.is_hyrox_official" class="px-1.5 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700" title="Station officielle de la course Hyrox">Hyrox</span>
                </span>
              </td>
              <td class="px-4 py-1.5 text-slate-600 whitespace-nowrap">
                {{ labelOf(MEASUREMENTS, entry.measurement_type) || '—' }}<span v-if="entry.default_unit" class="text-slate-400"> · {{ entry.default_unit }}</span>
              </td>
              <td class="px-4 py-1.5 text-slate-500"><span class="block max-w-80 truncate" :title="entry.notes ?? ''">{{ entry.notes }}</span></td>
              <td
                class="px-4 py-1.5 whitespace-nowrap tabular-nums"
                :class="store.usageOf('station', entry.id)?.planned ? 'text-slate-600' : 'text-slate-400'"
                :title="usageTitle(store.usageOf('station', entry.id))"
              >{{ usageText(store.usageOf('station', entry.id)) }}</td>
            </tr>
            <tr v-if="stations.length === 0">
              <td colspan="5" class="px-4 py-12 text-center text-sm text-slate-400">
                {{ search ? `Aucune station ne correspond à « ${search} ».` : 'Aucune station pour le moment.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <Transition name="fade">
      <div v-if="editing" class="fixed inset-0 bg-black/20 z-40" @click="close" />
    </Transition>
    <Transition name="slide">
      <CatalogDrawer
        v-if="editing"
        :key="`${editing.kind}-${editing.entry?.id ?? 'new'}`"
        :kind="editing.kind"
        :entry="editing.entry"
        @close="close"
        @done="done"
      />
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
