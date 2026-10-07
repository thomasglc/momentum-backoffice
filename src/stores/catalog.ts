import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useDirectus, isAuthError } from '@/composables/useDirectus'
import type { ExerciseCatalog, StationCatalog } from '@/types'
import { IMAGE_INDEX_URL, deletionBlock } from '@/utils/catalog'
import type { ImageEntry, Usage } from '@/utils/catalog'

export type CatalogKind = 'exercise' | 'station'
export type CatalogEntry = ExerciseCatalog | StationCatalog

const COLLECTION: Record<CatalogKind, string> = { exercise: 'exercise_catalog', station: 'station_catalog' }
const UNUSED: Usage = { planned: 0, logged: 0 }
const byName = <T extends { name: string }>(rows: T[]): T[] => [...rows].sort((a, b) => a.name.localeCompare(b.name, 'fr'))

// Catalogue d'exercices et de stations : les entrées, leurs utilisations, et la banque de photos.
// Les règles sont dans utils/catalog.
export const useCatalogStore = defineStore('catalog', () => {
  const directus = useDirectus()
  const router = useRouter()

  const exercises = ref<ExerciseCatalog[]>([])
  const stations = ref<StationCatalog[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

  // Utilisations par entrée ; null tant qu'on ne sait pas les compter
  const usage = shallowRef<Record<CatalogKind, Record<number, Usage>> | null>(null)
  const usageStatus = ref<'loading' | 'ready' | 'error'>('loading')

  async function loadUsage() {
    try {
      usage.value = await directus.fetchCatalogUsage()
      usageStatus.value = 'ready'
    } catch {
      usage.value = null
      usageStatus.value = 'error'
    }
  }

  /** Charge, ou recharge en gardant l'affichage. La liste s'affiche sans attendre le décompte. */
  async function load() {
    if (status.value !== 'ready') status.value = 'loading'
    try {
      const [exerciseRows, stationRows] = await Promise.all([directus.fetchExerciseCatalog(), directus.fetchStationCatalog()])
      exercises.value = byName(exerciseRows as unknown as ExerciseCatalog[])
      stations.value = byName(stationRows as unknown as StationCatalog[])
      status.value = 'ready'
    } catch (e) {
      if (isAuthError(e)) router.push('/login')
      status.value = 'error'
      return
    }
    await loadUsage()
  }

  /** Utilisations d'une entrée ; null si le décompte n'est pas connu */
  const usageOf = (kind: CatalogKind, id: number): Usage | null =>
    (usage.value ? usage.value[kind][id] ?? UNUSED : null)

  /** Crée une entrée (id null) ou la modifie, puis la range à sa place dans la liste */
  async function save(kind: CatalogKind, id: number | null, data: Record<string, unknown>): Promise<CatalogEntry> {
    const saved = (id == null
      ? await directus.createCollectionItem(COLLECTION[kind], data)
      : await directus.updateCollectionItem(COLLECTION[kind], id, data)) as unknown as CatalogEntry
    if (kind === 'exercise') exercises.value = byName([...exercises.value.filter(entry => entry.id !== saved.id), saved as ExerciseCatalog])
    else stations.value = byName([...stations.value.filter(entry => entry.id !== saved.id), saved as StationCatalog])
    return saved
  }

  /** Supprime une entrée qui ne sert nulle part. Le décompte est relu juste avant : celui de la page peut dater. */
  async function remove(kind: CatalogKind, id: number) {
    await loadUsage()
    const reason = deletionBlock(usageOf(kind, id))
    if (reason) throw new Error(reason)
    await directus.deleteCollectionItem(COLLECTION[kind], id)
    if (kind === 'exercise') exercises.value = exercises.value.filter(entry => entry.id !== id)
    else stations.value = stations.value.filter(entry => entry.id !== id)
  }

  // ── Banque de photos : lue à la première recherche, puis gardée ─────────────
  const images = shallowRef<ImageEntry[]>([])
  const imagesStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

  async function loadImages() {
    if (imagesStatus.value === 'ready' || imagesStatus.value === 'loading') return
    imagesStatus.value = 'loading'
    try {
      const response = await fetch(IMAGE_INDEX_URL)
      if (!response.ok) throw new Error(`Banque de photos : ${response.status}`)
      const rows = await response.json() as Partial<ImageEntry>[]
      // La banque décrit aussi muscles et consignes : on n'en garde que le nom et les photos
      images.value = rows.map(row => ({ id: String(row.id), name: String(row.name ?? ''), images: row.images ?? [] }))
      imagesStatus.value = 'ready'
    } catch {
      imagesStatus.value = 'error'
    }
  }

  return { exercises, stations, status, usageStatus, usageOf, load, save, remove, images, imagesStatus, loadImages }
})
