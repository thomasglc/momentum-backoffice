<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import type { CatalogEntry, CatalogKind } from '@/stores/catalog'
import type { ExerciseCatalog, StationCatalog } from '@/types'
import { CATEGORIES, EQUIPMENT, MEASUREMENTS, withCurrent } from '@/constants/catalog'
import { deletionBlock, exercisePayload, nameTaken, stationPayload } from '@/utils/catalog'
import ImagePicker from './ImagePicker.vue'

// Tiroir d'un exercice ou d'une station : création quand entry est vide, modification sinon
const props = defineProps<{ kind: CatalogKind; entry: CatalogEntry | null }>()
const emit = defineEmits<{ close: []; done: [message: string] }>()

const store = useCatalogStore()

const TEXTS = {
  exercise: {
    create: 'Nouvel exercice', edit: 'Modifier l\'exercice', submit: 'Créer l\'exercice', created: 'Exercice ajouté',
    taken: 'Un autre exercice porte déjà ce nom.', remove: 'Supprimer cet exercice', removed: 'Exercice supprimé',
    note: 'Affichée dans la fiche de l\'exercice, dans l\'application : alternative, matériel.',
  },
  station: {
    create: 'Nouvelle station', edit: 'Modifier la station', submit: 'Créer la station', created: 'Station ajoutée',
    taken: 'Une autre station porte déjà ce nom.', remove: 'Supprimer cette station', removed: 'Station supprimée',
    note: 'Note interne : l\'application ne l\'affiche pas.',
  },
}
const texts = computed(() => TEXTS[props.kind])

const source = (props.entry ?? {}) as Partial<ExerciseCatalog> & Partial<StationCatalog>
const form = reactive({
  name: source.name ?? '',
  category: source.category ?? '',
  equipment: source.equipment ?? '',
  measurement_type: source.measurement_type ?? 'distance',
  default_unit: source.default_unit ?? (props.entry ? '' : 'm'),
  is_hyrox_official: source.is_hyrox_official ?? false,
  notes: source.notes ?? '',
  image_urls: [...(source.image_urls ?? [])],
})

// L'unité suit le type de mesure tant qu'elle n'a pas été écrite à la main
const UNITS: Record<string, string> = { distance: 'm', reps: 'reps', time: 's', mixed: '' }
watch(() => form.measurement_type, (next, previous) => {
  if (form.default_unit.trim() === (UNITS[previous] ?? '')) form.default_unit = UNITS[next] ?? ''
})

const nameInput = ref<HTMLInputElement | null>(null)
onMounted(() => { if (!props.entry) nameInput.value?.focus() })

// ── Enregistrement ───────────────────────────────────────────────────────────
const saving = ref(false)
const saveError = ref<string | null>(null)

const taken = computed(() =>
  nameTaken(props.kind === 'exercise' ? store.exercises : store.stations, form.name, props.entry?.id ?? null))
const canSave = computed(() => form.name.trim() !== '' && !taken.value && !saving.value)

async function save() {
  if (!canSave.value) return
  saving.value = true
  saveError.value = null
  try {
    const data = props.kind === 'exercise' ? exercisePayload(form) : stationPayload(form)
    const saved = await store.save(props.kind, props.entry?.id ?? null, data)
    emit('done', props.entry ? `« ${saved.name} » enregistré` : texts.value.created)
  } catch {
    saveError.value = 'Enregistrement impossible. Réessaie dans un instant.'
  } finally {
    saving.value = false
  }
}

// ── Suppression : seulement une entrée qui ne sert nulle part ────────────────
const confirming = ref(false)
const removing = ref(false)
const removeError = ref<string | null>(null)
const blocked = computed(() => (props.entry ? deletionBlock(store.usageOf(props.kind, props.entry.id)) : null))

async function remove() {
  if (!props.entry || removing.value) return
  removing.value = true
  removeError.value = null
  try {
    await store.remove(props.kind, props.entry.id)
    emit('done', texts.value.removed)
  } catch (error) {
    removeError.value = error instanceof Error ? error.message : 'Suppression impossible. Réessaie dans un instant.'
    confirming.value = false
  } finally {
    removing.value = false
  }
}

const FIELD = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400'
const LABEL = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'
</script>

<template>
  <div class="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
      <h2 class="font-semibold text-slate-900">{{ entry ? texts.edit : texts.create }}</h2>
      <button type="button" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Fermer" @click="emit('close')">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      <div>
        <label for="catalog-name" :class="LABEL">Nom</label>
        <input id="catalog-name" ref="nameInput" v-model="form.name" type="text" :class="FIELD" />
        <p v-if="taken" role="alert" class="mt-1.5 text-xs text-red-500">{{ texts.taken }}</p>
      </div>

      <div v-if="kind === 'exercise'" class="grid grid-cols-2 gap-4">
        <div>
          <label for="catalog-category" :class="LABEL">Catégorie</label>
          <select id="catalog-category" v-model="form.category" :class="[FIELD, 'bg-white']">
            <option value="">— Non définie —</option>
            <option v-for="option in withCurrent(CATEGORIES, form.category)" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
        <div>
          <label for="catalog-equipment" :class="LABEL">Matériel</label>
          <select id="catalog-equipment" v-model="form.equipment" :class="[FIELD, 'bg-white']">
            <option value="">— Non défini —</option>
            <option v-for="option in withCurrent(EQUIPMENT, form.equipment)" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
      </div>

      <template v-else>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="catalog-measurement" :class="LABEL">Mesure</label>
            <select id="catalog-measurement" v-model="form.measurement_type" :class="[FIELD, 'bg-white']">
              <option v-for="option in withCurrent(MEASUREMENTS, form.measurement_type)" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div>
            <label for="catalog-unit" :class="LABEL">Unité</label>
            <input id="catalog-unit" v-model="form.default_unit" type="text" :class="FIELD" />
          </div>
        </div>
        <label class="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input v-model="form.is_hyrox_official" type="checkbox" class="h-4 w-4 rounded border-slate-300 accent-indigo-500" />
          Station officielle de la course Hyrox
        </label>
      </template>

      <div>
        <label for="catalog-notes" :class="LABEL">Note</label>
        <textarea id="catalog-notes" v-model="form.notes" rows="2" :class="[FIELD, 'resize-none']" />
        <p class="mt-1.5 text-xs text-slate-400">{{ texts.note }}</p>
      </div>

      <div>
        <span :class="LABEL">Photos</span>
        <p class="mb-2.5 text-xs text-slate-400">Montrées à l'athlète dans sa séance : le départ du mouvement, puis l'arrivée.</p>
        <ImagePicker v-model="form.image_urls" :name="form.name" />
      </div>

      <div v-if="entry" class="pt-4 border-t border-slate-100 text-sm">
        <p v-if="blocked" class="text-xs text-slate-500">{{ blocked }}</p>
        <button v-else-if="!confirming" type="button" class="text-red-600 hover:underline" @click="confirming = true">
          {{ texts.remove }}
        </button>
        <div v-else class="flex items-center gap-4">
          <span class="text-slate-700">Supprimer définitivement ?</span>
          <button type="button" class="font-medium text-red-600 hover:underline disabled:opacity-50" :disabled="removing" @click="remove">
            {{ removing ? 'Suppression…' : 'Oui, supprimer' }}
          </button>
          <button type="button" class="text-slate-500 hover:underline" :disabled="removing" @click="confirming = false">Annuler</button>
        </div>
        <p v-if="removeError && !blocked" role="alert" class="mt-1.5 text-xs text-red-500">{{ removeError }}</p>
      </div>
    </div>

    <div class="px-6 py-4 border-t border-slate-200 flex items-center gap-3">
      <button
        type="button"
        :disabled="!canSave"
        class="flex-1 bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        @click="save"
      >
        {{ saving ? 'Sauvegarde…' : entry ? 'Sauvegarder' : texts.submit }}
      </button>
      <button type="button" class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" @click="emit('close')">
        Annuler
      </button>
    </div>
    <p v-if="saveError" role="alert" class="px-6 pb-4 text-xs text-red-500">{{ saveError }}</p>
  </div>
</template>
