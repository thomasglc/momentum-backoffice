<script setup lang="ts">
import { ref } from 'vue'
import type { StationEntry, StationCatalog } from '@/types'

const props = defineProps<{
  initialStations: StationEntry[]
  catalog: StationCatalog[]
  blockId: number
  childCollection: string
  parentKey: string
}>()

interface StationRow {
  _key: number
  _isNew: boolean
  _toDelete: boolean
  id?: number
  station_catalog_id: number
  name: string
  position: number
  distance_m: number | null
  reps: number | null
  duration_sec: number | null
  weight_kg_female: number | null
  weight_kg_male: number | null
  custom_label: string | null
  note: string | null
}

let nextKey = 0

const rows = ref<StationRow[]>(
  props.initialStations.map(s => ({
    _key: nextKey++,
    _isNew: false,
    _toDelete: false,
    id: s.id,
    station_catalog_id: typeof s.station_id === 'object' ? (s.station_id as StationCatalog).id : s.station_id as unknown as number,
    name: typeof s.station_id === 'object' ? (s.station_id as StationCatalog).name : '',
    position: s.position,
    distance_m: s.distance_m,
    reps: s.reps,
    duration_sec: s.duration_sec,
    weight_kg_female: s.weight_kg_female,
    weight_kg_male: s.weight_kg_male,
    custom_label: s.custom_label,
    note: s.note,
  }))
)

function addStation() {
  const first = props.catalog[0]
  if (!first) return
  rows.value.push({
    _key: nextKey++,
    _isNew: true,
    _toDelete: false,
    station_catalog_id: first.id,
    name: first.name,
    position: rows.value.filter(r => !r._toDelete).length + 1,
    distance_m: null,
    reps: null,
    duration_sec: null,
    weight_kg_female: null,
    weight_kg_male: null,
    custom_label: null,
    note: null,
  })
}

function removeRow(row: StationRow) {
  if (row._isNew) {
    rows.value = rows.value.filter(r => r._key !== row._key)
  } else {
    row._toDelete = true
  }
}

function onCatalogChange(row: StationRow, id: number) {
  row.station_catalog_id = id
  row.name = props.catalog.find(c => c.id === id)?.name ?? ''
}

function getOps() {
  const existing = rows.value.filter(r => !r._isNew && !r._toDelete)
  const toCreate = rows.value.filter(r => r._isNew && !r._toDelete)
  const toDelete = rows.value.filter(r => !r._isNew && r._toDelete)

  return {
    collection: props.childCollection,
    create: toCreate.map((r, i) => ({
      [props.parentKey]: props.blockId,
      station_id: r.station_catalog_id,
      position: existing.length + i + 1,
      distance_m: r.distance_m,
      reps: r.reps,
      duration_sec: r.duration_sec,
      weight_kg_female: r.weight_kg_female,
      weight_kg_male: r.weight_kg_male,
      custom_label: r.custom_label,
      note: r.note,
    })),
    update: existing.map(r => ({
      id: r.id!,
      data: {
        station_id: r.station_catalog_id,
        distance_m: r.distance_m,
        reps: r.reps,
        duration_sec: r.duration_sec,
        weight_kg_female: r.weight_kg_female,
        weight_kg_male: r.weight_kg_male,
        custom_label: r.custom_label,
        note: r.note,
      },
    })),
    delete: toDelete.map(r => r.id!),
  }
}

defineExpose({ getOps })
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="row in rows.filter(r => !r._toDelete)"
      :key="row._key"
      class="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50"
    >
      <div class="flex items-center gap-2">
        <select
          :value="row.station_catalog_id"
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
      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="block text-xs text-slate-400 mb-0.5">Distance (m)</label>
          <input v-model.number="row.distance_m" type="number" placeholder="—"
            class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-0.5">Reps</label>
          <input v-model.number="row.reps" type="number" placeholder="—"
            class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-0.5">Durée (sec)</label>
          <input v-model.number="row.duration_sec" type="number" placeholder="—"
            class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs text-slate-400 mb-0.5">Poids F (kg)</label>
          <input v-model.number="row.weight_kg_female" type="number" step="0.5" placeholder="—"
            class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-0.5">Poids H (kg)</label>
          <input v-model.number="row.weight_kg_male" type="number" step="0.5" placeholder="—"
            class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-0.5">Label personnalisé</label>
        <input v-model="row.custom_label" type="text" placeholder="—"
          class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-0.5">Note</label>
        <input v-model="row.note" type="text" placeholder="—"
          class="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
    </div>

    <button
      type="button"
      @click="addStation"
      :disabled="catalog.length === 0"
      class="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-colors"
    >
      + Ajouter une station
    </button>
  </div>
</template>
