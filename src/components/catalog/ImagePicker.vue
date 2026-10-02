<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { cleanUrls, imageUrls, searchImages } from '@/utils/catalog'
import type { ImageEntry } from '@/utils/catalog'

// Photos d'une entrée du catalogue : celles en place, la recherche dans la banque, l'ajout d'une adresse
const props = defineProps<{
  modelValue: string[]
  /** Nom de l'entrée, proposé comme première recherche */
  name: string
}>()
const emit = defineEmits<{ 'update:modelValue': [urls: string[]] }>()

const store = useCatalogStore()

// ── Photos en place ──────────────────────────────────────────────────────────
const broken = ref(new Set<string>())
const remove = (url: string) => emit('update:modelValue', props.modelValue.filter(kept => kept !== url))

// ── Recherche dans la banque ─────────────────────────────────────────────────
const query = ref('')
const searching = computed(() => query.value.trim().length >= 2)
const results = computed(() => searchImages(store.images, query.value))

// La banque ne se charge qu'à la première recherche
watch(searching, active => { if (active) store.loadImages() })

const isChosen = (entry: ImageEntry) => {
  const urls = imageUrls(entry)
  return urls.length === props.modelValue.length && urls.every((url, index) => url === props.modelValue[index])
}
// Les photos d'un mouvement vont ensemble (départ, arrivée) : en choisir un remplace les photos en place
const choose = (entry: ImageEntry) => emit('update:modelValue', imageUrls(entry))

// ── Adresse collée ───────────────────────────────────────────────────────────
const pasted = ref('')
const pastedError = ref(false)

function addPasted() {
  // https seulement : l'application est servie en https et n'afficherait pas une image en http
  const url = cleanUrls([pasted.value]).find(kept => kept.toLowerCase().startsWith('https://'))
  pastedError.value = !url
  if (!url) return
  emit('update:modelValue', cleanUrls([...props.modelValue, url]))
  pasted.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <ul v-if="modelValue.length" class="flex flex-wrap gap-3">
      <li v-for="(url, index) in modelValue" :key="url" class="relative">
        <img
          v-if="!broken.has(url)"
          :src="url"
          alt=""
          class="h-20 w-28 rounded-lg border border-slate-200 bg-slate-100 object-cover"
          @error="broken.add(url)"
        />
        <span
          v-else
          class="flex h-20 w-28 items-center justify-center rounded-lg border border-dashed border-red-300 px-2 text-center text-xs text-red-500"
        >Image introuvable</span>
        <button
          type="button"
          class="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-red-200 hover:text-red-500 transition-colors"
          :aria-label="`Retirer la photo ${index + 1}`"
          :title="`Retirer la photo ${index + 1}`"
          @click="remove(url)"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </li>
    </ul>
    <p v-else class="text-sm text-slate-400">Aucune photo.</p>

    <div>
      <input
        v-model="query"
        type="search"
        placeholder="Chercher dans la banque : nom anglais du mouvement"
        aria-label="Chercher des photos dans la banque"
        class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
      />
      <button
        v-if="!query && name.trim()"
        type="button"
        class="mt-1.5 text-xs font-medium text-indigo-600 hover:underline"
        @click="query = name.trim()"
      >Chercher « {{ name.trim() }} »</button>

      <template v-if="searching">
        <p v-if="store.imagesStatus === 'loading'" class="mt-2 text-xs text-slate-400">Chargement de la banque…</p>
        <p v-else-if="store.imagesStatus === 'error'" role="alert" class="mt-2 text-xs text-red-500">
          Banque de photos indisponible.
          <button type="button" class="font-medium underline" @click="store.loadImages()">Réessayer</button>
        </p>
        <ul v-else-if="results.length" class="mt-2 space-y-1.5">
          <li v-for="entry in results" :key="entry.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg border p-1.5 text-left text-sm transition-colors"
              :class="isChosen(entry) ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'"
              :aria-pressed="isChosen(entry)"
              @click="choose(entry)"
            >
              <span class="flex shrink-0 gap-1">
                <img
                  v-for="url in imageUrls(entry).slice(0, 2)"
                  :key="url"
                  :src="url"
                  alt=""
                  loading="lazy"
                  class="h-12 w-16 rounded bg-slate-100 object-cover"
                />
              </span>
              <span class="min-w-0 flex-1 truncate text-slate-700">{{ entry.name }}</span>
              <span v-if="isChosen(entry)" class="shrink-0 pr-1 text-xs font-medium text-indigo-600">Choisi</span>
            </button>
          </li>
        </ul>
        <p v-else class="mt-2 text-xs text-slate-500">
          Aucun mouvement pour « {{ query.trim() }} ». La banque est en anglais : essaie « lunge » ou « bench press ».
        </p>
      </template>
    </div>

    <div>
      <div class="flex gap-2">
        <input
          v-model="pasted"
          type="url"
          placeholder="Ou coller l'adresse d'une image : https://…"
          aria-label="Adresse d'une image"
          class="min-w-0 flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          @keydown.enter.prevent="addPasted"
        />
        <button
          type="button"
          :disabled="!pasted.trim()"
          class="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          @click="addPasted"
        >Ajouter</button>
      </div>
      <p v-if="pastedError" role="alert" class="mt-1.5 text-xs text-red-500">Adresse attendue : elle commence par https://</p>
    </div>
  </div>
</template>
