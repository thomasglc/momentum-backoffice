<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import type { BlockStrength, ExerciseCatalog } from '@/types'
import { useDirectus } from '@/composables/useDirectus'

const props = defineProps<{ block: BlockStrength; isSaving: boolean }>()
const emit = defineEmits<{
  save: [payload: { _block: Partial<BlockStrength>; _itemOps: ItemOps }]
  cancel: []
}>()

interface ItemOps {
  collection: string
  create: Record<string, unknown>[]
  update: { id: number; data: Record<string, unknown> }[]
  delete: number[]
}

interface ExerciseRow {
  _key: number
  _isNew: boolean
  _toDelete: boolean
  id?: number
  exercise_catalog_id: number
  name: string
  position: number
  sets: number | null
  reps: number | null
  duration_sec: number | null
  weight_kg: number | null
  custom_label: string | null
  note: string | null
}

const directus = useDirectus()
const catalog = ref<ExerciseCatalog[]>([])
let nextKey = 0

const form = reactive({ rest_sec: props.block.rest_sec, note: props.block.note })

const rows = ref<ExerciseRow[]>(
  (props.block.exercises ?? []).map(ex => ({
    _key: nextKey++,
    _isNew: false,
    _toDelete: false,
    id: ex.id,
    exercise_catalog_id: typeof ex.exercise_id === 'object' ? (ex.exercise_id as ExerciseCatalog).id : ex.exercise_id as unknown as number,
    name: typeof ex.exercise_id === 'object' ? (ex.exercise_id as ExerciseCatalog).name : '',
    position: ex.position,
    sets: ex.sets,
    reps: ex.reps,
    duration_sec: ex.duration_sec,
    weight_kg: ex.weight_kg,
    custom_label: ex.custom_label,
    note: ex.note,
  }))
)

onMounted(async () => {
  catalog.value = (await directus.fetchExerciseCatalog()) as ExerciseCatalog[]
})

function addExercise() {
  const first = catalog.value[0]
  if (!first) return
  rows.value.push({
    _key: nextKey++,
    _isNew: true,
    _toDelete: false,
    exercise_catalog_id: first.id,
    name: first.name,
    position: rows.value.filter(r => !r._toDelete).length + 1,
    sets: null,
    reps: null,
    duration_sec: null,
    weight_kg: null,
    custom_label: null,
    note: null,
  })
}

function removeRow(row: ExerciseRow) {
  if (row._isNew) {
    rows.value = rows.value.filter(r => r._key !== row._key)
  } else {
    row._toDelete = true
  }
}

function onCatalogChange(row: ExerciseRow, id: number) {
  row.exercise_catalog_id = id
  row.name = catalog.value.find(c => c.id === id)?.name ?? ''
}

function handleSubmit() {
  const existing = rows.value.filter(r => !r._isNew && !r._toDelete)
  const toCreate = rows.value.filter(r => r._isNew && !r._toDelete)
  const toDelete = rows.value.filter(r => !r._isNew && r._toDelete)

  emit('save', {
    _block: { rest_sec: form.rest_sec, note: form.note },
    _itemOps: {
      collection: 'block_strength_exercises',
      create: toCreate.map((r, i) => ({
        block_strength_id: props.block.id,
        exercise_id: r.exercise_catalog_id,
        position: existing.length + i + 1,
        sets: r.sets,
        reps: r.reps,
        duration_sec: r.duration_sec,
        weight_kg: r.weight_kg,
        custom_label: r.custom_label,
        note: r.note,
      })),
      update: existing.map(r => ({
        id: r.id!,
        data: {
          exercise_id: r.exercise_catalog_id,
          sets: r.sets,
          reps: r.reps,
          duration_sec: r.duration_sec,
          weight_kg: r.weight_kg,
          custom_label: r.custom_label,
          note: r.note,
        },
      })),
      delete: toDelete.map(r => r.id!),
    },
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-5">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Repos entre séries (sec)</label>
        <input v-model.number="form.rest_sec" type="number"
          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Note</label>
      <textarea v-model="form.note" rows="2"
        class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Exercices</span>
        <span v-if="catalog.length === 0" class="text-xs text-slate-400">Chargement…</span>
      </div>

      <div class="space-y-2">
        <div
          v-for="row in rows.filter(r => !r._toDelete)"
          :key="row._key"
          class="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50"
        >
          <div class="flex items-center gap-2">
            <select
              :value="row.exercise_catalog_id"
              @change="onCatalogChange(row, Number(($event.target as HTMLSelectElement).value))"
              class="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option v-for="c in catalog" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <button type="button" @click="removeRow(row)" class="text-slate-400 hover:text-red-500 transition-colors p-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <div>
              <label class="block text-xs text-slate-400 mb-0.5">Séries</label>
              <input v-model.number="row.sets" type="number" placeholder="—"
                class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-0.5">Reps</label>
              <input v-model.number="row.reps" type="number" placeholder="—"
                class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-0.5">Durée (s)</label>
              <input v-model.number="row.duration_sec" type="number" placeholder="—"
                class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-0.5">Poids (kg)</label>
              <input v-model.number="row.weight_kg" type="number" step="0.5" placeholder="—"
                class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-0.5">Label / Note</label>
            <input v-model="row.note" type="text" placeholder="—"
              class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>

        <button
          type="button"
          @click="addExercise"
          :disabled="catalog.length === 0"
          class="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-colors"
        >
          + Ajouter un exercice
        </button>
      </div>
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
