// Copie d'une semaine ou d'un plan dans Directus : séances, blocs par type, lignes d'exercices et de stations.
// La logique ne connaît que deux gestes (lire par filtre, créer par lots) : elle se teste sans Directus.

export type Row = Record<string, unknown>
export type Filter = Record<string, { _eq?: unknown; _in?: unknown[] }>

export interface CopyApi {
  /** Toutes les lignes d'une collection qui passent le filtre, champs bruts */
  read(collection: string, filter: Filter): Promise<Row[]>
  /** Crée les lignes en un lot et renvoie les lignes créées, dans un ordre quelconque */
  create(collection: string, rows: Row[]): Promise<Row[]>
}

// Champs recopiés, collection par collection. Tout le reste est laissé de côté : identifiants, dates,
// et surtout les champs relationnels inverses que Directus renvoie (weeks, sessions, exercises, stations).
// Les renvoyer rattacherait les lignes de la source à la copie.
const PLAN_FIELDS = ['title', 'description', 'start_date', 'sport', 'level', 'status', 'plan_type', 'total_weeks', 'phase_names']
const WEEK_FIELDS = ['plan_id', 'week_number', 'phase', 'theme', 'is_deload', 'week_note']
const SESSION_FIELDS = ['week_id', 'day', 'type', 'optional', 'title', 'description', 'duration_min', 'intensity_score', 'coach_tip', 'sort_order']
const STATION_FIELDS = ['station_id', 'position', 'distance_m', 'reps', 'duration_sec', 'weight_kg_female', 'weight_kg_male', 'custom_label', 'note']

interface BlockSpec {
  fields: string[]
  child?: { collection: string; fk: string; fields: string[] }
}

/** Les sept types de bloc, leurs champs, et la collection de leurs lignes quand ils en ont */
export const BLOCKS: Record<string, BlockSpec> = {
  block_cardio: { fields: ['subtype', 'duration_min', 'pace_zone', 'label', 'note'] },
  block_intervals: { fields: ['sets', 'distance_km', 'duration_min', 'recovery_min', 'pace_zone', 'note'] },
  block_strength: {
    fields: ['rest_sec', 'note'],
    child: {
      collection: 'block_strength_exercises',
      fk: 'block_strength_id',
      fields: ['exercise_id', 'position', 'sets', 'reps', 'duration_sec', 'weight_kg', 'custom_label', 'note'],
    },
  },
  block_circuit: {
    fields: ['format', 'label', 'rounds', 'duration_min', 'rest_between_min', 'note'],
    child: { collection: 'block_circuit_stations', fk: 'block_circuit_id', fields: STATION_FIELDS },
  },
  block_mini_race: {
    fields: ['rounds', 'run_distance_km', 'pace_zone', 'rest_between_rounds_min', 'note'],
    child: { collection: 'block_mini_race_stations', fk: 'block_mini_race_id', fields: STATION_FIELDS },
  },
  block_station_activation: {
    fields: ['rounds', 'note'],
    child: { collection: 'block_station_activation_entries', fk: 'block_station_activation_id', fields: STATION_FIELDS },
  },
  block_station_block: {
    fields: ['brick_format', 'format_note'],
    child: { collection: 'block_station_block_entries', fk: 'block_station_block_id', fields: STATION_FIELDS },
  },
}

// Une relation peut revenir dépliée ({ id, … }) : on n'en garde que l'identifiant
const RELATIONS = new Set(['exercise_id', 'station_id'])
const idOf = (value: unknown): unknown =>
  (value !== null && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value)

function pick(row: Row, fields: string[]): Row {
  const out: Row = {}
  for (const field of fields) {
    if (row[field] === undefined) continue
    out[field] = RELATIONS.has(field) ? idOf(row[field]) : row[field]
  }
  return out
}

const byId = (rows: Row[]): Row[] => [...rows].sort((a, b) => Number(a.id) - Number(b.id))

/**
 * Crée des lignes en un lot et les renvoie dans l'ordre où elles ont été envoyées.
 * Directus attribue les identifiants dans cet ordre : on trie donc la réponse par identifiant,
 * puis on contrôle le nombre de lignes et un champ témoin avant de s'y fier.
 */
async function createInOrder(api: CopyApi, collection: string, rows: Row[], witness?: string): Promise<Row[]> {
  if (!rows.length) return []
  const created = byId(await api.create(collection, rows))
  const consistent = created.length === rows.length
    && (!witness || created.every((row, index) => String(row[witness] ?? '') === String(rows[index]![witness] ?? '')))
  if (!consistent) throw new Error(`Copie interrompue : Directus n'a pas renvoyé les lignes attendues pour ${collection}.`)
  return created
}

/**
 * Copie une semaine dans un plan, sous le numéro donné : ses séances, leurs blocs et les lignes des blocs.
 * La source n'est pas modifiée. Les séances copiées n'ont pas de slug (il est unique).
 */
export async function copyWeek(
  api: CopyApi,
  sourceWeekId: number,
  target: { planId: number; weekNumber: number },
): Promise<{ weekId: number; sessions: number; blocks: number }> {
  const [week] = await api.read('weeks', { id: { _eq: sourceWeekId } })
  if (!week) throw new Error(`Semaine ${sourceWeekId} introuvable.`)

  const [newWeek] = await createInOrder(api, 'weeks', [
    { ...pick(week, WEEK_FIELDS), plan_id: target.planId, week_number: target.weekNumber },
  ], 'week_number')

  const sessions = byId(await api.read('sessions', { week_id: { _eq: sourceWeekId } }))
  const newSessions = await createInOrder(api, 'sessions', sessions.map(session => (
    { ...pick(session, SESSION_FIELDS), week_id: newWeek!.id, slug: null }
  )), 'title')
  const sessionIds = new Map(sessions.map((session, index) => [session.id, newSessions[index]!.id]))

  const links = sessions.length
    ? byId(await api.read('session_blocks', { session_id: { _in: sessions.map(session => session.id) } }))
    : []

  // Blocs, type par type, puis leurs lignes rattachées aux nouveaux blocs
  const blockIds = new Map<string, unknown>() // « type:ancien id » → nouvel id
  for (const [type, spec] of Object.entries(BLOCKS)) {
    const ids = [...new Set(links.filter(link => link.block_type === type).map(link => link.block_id))]
    if (!ids.length) continue
    const blocks = byId(await api.read(type, { id: { _in: ids } }))
    const newBlocks = await createInOrder(api, type, blocks.map(block => pick(block, spec.fields)))
    blocks.forEach((block, index) => blockIds.set(`${type}:${block.id}`, newBlocks[index]!.id))

    const child = spec.child
    if (!child || !blocks.length) continue
    const children = byId(await api.read(child.collection, { [child.fk]: { _in: blocks.map(block => block.id) } }))
    await createInOrder(api, child.collection, children.map(row => (
      { ...pick(row, child.fields), [child.fk]: blockIds.get(`${type}:${idOf(row[child.fk])}`) }
    )), 'position')
  }

  // Les liaisons en dernier : une copie interrompue laisse des séances sans bloc, jamais une liaison vers rien
  const newLinks = links
    .filter(link => blockIds.has(`${link.block_type}:${link.block_id}`))
    .map(link => ({
      session_id: sessionIds.get(link.session_id),
      position: link.position,
      block_type: link.block_type,
      block_id: blockIds.get(`${link.block_type}:${link.block_id}`),
    }))
  await createInOrder(api, 'session_blocks', newLinks, 'position')

  return { weekId: Number(newWeek!.id), sessions: newSessions.length, blocks: newLinks.length }
}

/**
 * Copie un plan et toutes ses semaines dans un nouveau plan en brouillon. Renvoie son identifiant.
 * onProgress(faites, total) est appelé avant la première semaine, puis après chacune.
 */
export async function copyPlan(
  api: CopyApi,
  planId: number,
  overrides: { title: string },
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const [plan] = await api.read('plans', { id: { _eq: planId } })
  if (!plan) throw new Error(`Plan ${planId} introuvable.`)

  const [newPlan] = await createInOrder(api, 'plans', [
    { ...pick(plan, PLAN_FIELDS), title: overrides.title, status: 'draft' },
  ], 'title')
  const newPlanId = Number(newPlan!.id)

  const weeks = (await api.read('weeks', { plan_id: { _eq: planId } }))
    .sort((a, b) => Number(a.week_number) - Number(b.week_number))
  onProgress?.(0, weeks.length)
  for (const [index, week] of weeks.entries()) {
    try {
      await copyWeek(api, Number(week.id), { planId: newPlanId, weekNumber: Number(week.week_number) })
    } catch (cause) {
      throw new Error(`Copie interrompue à la semaine ${week.week_number} : le plan « ${overrides.title} » est incomplet.`, { cause })
    }
    onProgress?.(index + 1, weeks.length)
  }
  return newPlanId
}
