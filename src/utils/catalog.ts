// Catalogue d'exercices et de stations : photos, contenu envoyé à Directus, décompte des utilisations.
// Aucun import : la logique se teste sans Directus ni navigateur.

// ── Photos ───────────────────────────────────────────────────────────────────
// free-exercise-db, figée sur une version : la banque dont viennent déjà les photos de l'application.
export const IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/'
export const IMAGE_INDEX_URL = `${IMAGE_BASE}dist/exercises.json`

/** Un mouvement de la banque : son nom anglais et ses photos (position de départ, position d'arrivée) */
export interface ImageEntry {
  id: string
  name: string
  images: string[]
}

export const imageUrls = (entry: ImageEntry): string[] => entry.images.map(image => `${IMAGE_BASE}exercises/${image}`)

// Sans casse, sans accent, sans ponctuation : « Farmer's Walk » se trouve en tapant « farmers walk »
const fold = (text: string): string =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Vrai si le texte contient la recherche, à la casse, aux accents et à la ponctuation près */
export const matchesText = (text: string, query: string): boolean => fold(text).includes(fold(query))

/**
 * Mouvements dont le nom contient tous les mots saisis, du nom le plus court au plus long : les mouvements
 * de base passent avant leurs variantes. Il faut au moins deux caractères ; les mouvements sans photo sont écartés.
 */
export function searchImages(index: ImageEntry[], query: string, limit = 8): ImageEntry[] {
  const wanted = fold(query)
  if (wanted.length < 2) return []
  const words = wanted.split(' ')
  return index
    .filter(entry => entry.images.length > 0)
    .map(entry => ({ entry, name: fold(entry.name) }))
    .filter(({ name }) => words.every(word => name.includes(word)))
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ entry }) => entry)
}

/** Adresses web seulement, sans espace autour ni doublon, dans l'ordre saisi */
export function cleanUrls(urls: string[]): string[] {
  const kept: string[] = []
  for (const raw of urls) {
    const url = raw.trim()
    if (/^https?:\/\/\S+$/i.test(url) && !kept.includes(url)) kept.push(url)
  }
  return kept
}

// ── Contenu envoyé à Directus ────────────────────────────────────────────────
export interface ExerciseForm {
  name: string
  category: string
  equipment: string
  notes: string
  image_urls: string[]
}

export interface StationForm {
  name: string
  measurement_type: string
  default_unit: string
  is_hyrox_official: boolean
  notes: string
  image_urls: string[]
}

const textOrNull = (value: string): string | null => value.trim() || null
const urlsOrNull = (urls: string[]): string[] | null => {
  const kept = cleanUrls(urls)
  return kept.length ? kept : null
}

export const exercisePayload = (form: ExerciseForm) => ({
  name: form.name.trim(),
  category: textOrNull(form.category),
  equipment: textOrNull(form.equipment),
  notes: textOrNull(form.notes),
  image_urls: urlsOrNull(form.image_urls),
})

export const stationPayload = (form: StationForm) => ({
  name: form.name.trim(),
  measurement_type: form.measurement_type,
  default_unit: textOrNull(form.default_unit),
  is_hyrox_official: form.is_hyrox_official,
  notes: textOrNull(form.notes),
  image_urls: urlsOrNull(form.image_urls),
})

/** Vrai si une autre entrée porte déjà ce nom, à la casse, aux accents et à la ponctuation près */
export function nameTaken(entries: { id: number; name: string }[], name: string, exceptId: number | null): boolean {
  const wanted = fold(name)
  return wanted !== '' && entries.some(entry => entry.id !== exceptId && fold(entry.name) === wanted)
}

// ── Utilisations ─────────────────────────────────────────────────────────────
/** Lignes qui pointent vers une entrée : dans les séances des plans, et dans ce que les athlètes ont saisi */
export interface Usage {
  planned: number
  logged: number
}

export interface RelationRow {
  collection: string
  field: string
  related_collection: string | null
}

/** Décompte groupé d'une collection : une ligne par entrée du catalogue, { [champ]: identifiant, count } */
export interface UsageGroup {
  collection: string
  field: string
  rows: Record<string, unknown>[]
}

/** Champs qui pointent vers un catalogue, d'après les relations de Directus */
export const referencesTo = (relations: RelationRow[], catalog: string): { collection: string; field: string }[] =>
  relations
    .filter(relation => relation.related_collection === catalog)
    .map(({ collection, field }) => ({ collection, field }))

/**
 * Additionne les décomptes par entrée. Les collections block_* sont les séances des plans ;
 * toutes les autres (set_logs…) sont des saisies d'athlètes.
 */
export function countUsage(groups: UsageGroup[]): Record<number, Usage> {
  const usage: Record<number, Usage> = {}
  for (const { collection, field, rows } of groups) {
    const side = collection.startsWith('block_') ? 'planned' : 'logged'
    for (const row of rows) {
      const count = Number(row.count) // Directus renvoie le décompte en texte
      if (row[field] == null || !Number.isFinite(count)) continue
      const entry = (usage[Number(row[field])] ??= { planned: 0, logged: 0 })
      entry[side] += count
    }
  }
  return usage
}

const counted = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`

/** Résumé pour la liste ; null : décompte indisponible */
export function usageLabel(usage: Usage | null): string {
  if (!usage) return '—'
  if (usage.planned) return `${usage.planned} fois`
  return usage.logged ? 'Historique seul' : 'Jamais'
}

/**
 * Raison qui empêche de supprimer une entrée, ou null si elle ne sert nulle part.
 * Directus viderait la référence des lignes qui l'utilisent : les séances perdraient l'exercice sans prévenir.
 */
export function deletionBlock(usage: Usage | null): string | null {
  if (!usage) return 'Utilisations inconnues pour le moment : suppression impossible.'
  if (usage.planned) return `${counted(usage.planned, 'utilisation', 'utilisations')} dans les plans : à retirer des séances avant de supprimer.`
  if (usage.logged) return `${counted(usage.logged, 'saisie d\'athlète', 'saisies d\'athlètes')} sur cette entrée : suppression impossible.`
  return null
}

// ── Notes ────────────────────────────────────────────────────────────────────
/** Une note de ligne se lit en pastilles, comme dans l'application : « 6-8 reps · RIR 2 » → deux pastilles */
export const noteChips = (note: string | null | undefined): string[] =>
  (note ?? '').split('·').map(part => part.trim()).filter(Boolean)
