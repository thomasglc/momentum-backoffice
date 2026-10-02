import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyWeek, copyPlan } from '../src/utils/duplicate.ts'
import type { CopyApi, Row } from '../src/utils/duplicate.ts'

// ── Faux Directus en mémoire : lecture par filtre, création par lots ─────────
const SEED: Record<string, Row[]> = {
  plans: [{ id: 1, title: 'Solo', description: 'Prépa', start_date: '2026-10-05', sport: 'hyrox', level: 'open', status: 'active', plan_type: 'open_solo', total_weeks: 19, phase_names: { 1: 'Force' }, weeks: [10, 11] }],
  weeks: [
    { id: 10, plan_id: 1, week_number: 3, phase: 2, theme: 'Volume', is_deload: false, week_note: 'Note', sessions: [100, 101, 102] },
    { id: 11, plan_id: 1, week_number: 4, phase: 2, theme: 'Décharge', is_deload: true, week_note: null, sessions: [110] },
  ],
  sessions: [
    { id: 100, week_id: 10, day: 'Lundi', type: 'strength', optional: false, title: 'Muscu A', description: null, duration_min: 60, intensity_score: 7, coach_tip: 'Conseil', slug: 'w3-muscu-a', sort_order: 1 },
    { id: 101, week_id: 10, day: 'Mardi', type: 'running', optional: true, title: 'Footing', description: 'Souple', duration_min: null, intensity_score: null, coach_tip: null, slug: 'w3-run', sort_order: null },
    { id: 102, week_id: 10, day: 'Jeudi', type: 'hyrox', optional: false, title: 'Circuit', description: null, duration_min: 45, intensity_score: 8, coach_tip: null, slug: null, sort_order: null },
    { id: 110, week_id: 11, day: 'Lundi', type: 'strength', optional: false, title: 'Muscu allégée', description: null, duration_min: 50, intensity_score: 5, coach_tip: null, slug: 'w4-muscu-a', sort_order: null },
  ],
  session_blocks: [
    { id: 1, session_id: 100, position: 0, block_type: 'block_strength', block_id: 500 },
    { id: 2, session_id: 100, position: 1, block_type: 'block_cardio', block_id: 600 },
    { id: 3, session_id: 102, position: 0, block_type: 'block_circuit', block_id: 700 },
    { id: 4, session_id: 110, position: 0, block_type: 'block_strength', block_id: 501 },
  ],
  // exercises et stations : champs relationnels inverses, que Directus renvoie avec « * »
  block_strength: [
    { id: 500, rest_sec: 150, note: 'Polyarticulaires', exercises: [900, 901] },
    { id: 501, rest_sec: 90, note: null, exercises: [902] },
  ],
  block_strength_exercises: [
    { id: 900, block_strength_id: 500, exercise_id: 18, position: 0, sets: 4, reps: 5, duration_sec: null, weight_kg: null, custom_label: null, note: 'RIR 2' },
    { id: 901, block_strength_id: 500, exercise_id: 4, position: 1, sets: 3, reps: 6, duration_sec: null, weight_kg: 80, custom_label: null, note: null },
    { id: 902, block_strength_id: 501, exercise_id: 18, position: 0, sets: 3, reps: 5, duration_sec: null, weight_kg: null, custom_label: null, note: null },
  ],
  block_cardio: [{ id: 600, subtype: 'cooldown', duration_min: 10, pace_zone: 'Z1', label: 'Retour au calme', note: null }],
  block_circuit: [{ id: 700, format: 'rounds', label: null, rounds: 4, duration_min: null, rest_between_min: 1.5, note: 'Lourd', stations: [950] }],
  block_circuit_stations: [{ id: 950, block_circuit_id: 700, station_id: 6, position: 0, distance_m: 30, reps: null, duration_sec: null, weight_kg_female: null, weight_kg_male: null, custom_label: null, note: '30-40 m' }],
}

function fakeDirectus(options: { dropOne?: string } = {}) {
  const tables: Record<string, Row[]> = structuredClone(SEED)
  let nextId = 1000
  const matches = (row: Row, filter: Record<string, { _eq?: unknown; _in?: unknown[] }>) =>
    Object.entries(filter).every(([field, rule]) => (rule._in ? rule._in.includes(row[field]) : row[field] === rule._eq))
  const api: CopyApi = {
    read: async (collection, filter) => (tables[collection] ?? []).filter(row => matches(row, filter)).map(row => ({ ...row })),
    create: async (collection, rows) => {
      const created = rows.map(row => ({ id: nextId++, ...row }))
      ;(tables[collection] ??= []).push(...created)
      const returned = options.dropOne === collection ? created.slice(1) : created
      return [...returned].reverse() // Directus ne garantit pas l'ordre de la réponse
    },
  }
  const created = (collection: string) => (tables[collection] ?? []).filter(row => (row.id as number) >= 1000)
  return { api, tables, created }
}

// ── copie d'une semaine ──────────────────────────────────────────────────────
test('copyWeek crée la semaine, ses séances, ses blocs et leurs lignes', async () => {
  const { api, created } = fakeDirectus()
  const result = await copyWeek(api, 10, { planId: 1, weekNumber: 9 })

  const [week] = created('weeks')
  assert.deepEqual(week, { id: week!.id, plan_id: 1, week_number: 9, phase: 2, theme: 'Volume', is_deload: false, week_note: 'Note' })
  assert.deepEqual(result, { weekId: week!.id, sessions: 3, blocks: 3 })

  const sessions = created('sessions')
  assert.deepEqual(sessions.map(s => [s.week_id, s.day, s.title, s.optional, s.slug]), [
    [week!.id, 'Lundi', 'Muscu A', false, null],
    [week!.id, 'Mardi', 'Footing', true, null],
    [week!.id, 'Jeudi', 'Circuit', false, null],
  ])
  assert.deepEqual([sessions[0]!.duration_min, sessions[0]!.coach_tip, sessions[0]!.sort_order, sessions[1]!.description], [60, 'Conseil', 1, 'Souple'])
})

test('copyWeek rattache les blocs et leurs lignes aux copies, jamais à la source', async () => {
  const { api, created } = fakeDirectus()
  await copyWeek(api, 10, { planId: 1, weekNumber: 9 })

  const [muscu, , circuitSession] = created('sessions')
  const [strength] = created('block_strength')
  const [cardio] = created('block_cardio')
  const [circuit] = created('block_circuit')
  assert.deepEqual(strength, { id: strength!.id, rest_sec: 150, note: 'Polyarticulaires' }) // pas de champ « exercises »
  assert.deepEqual(circuit, { id: circuit!.id, format: 'rounds', label: null, rounds: 4, duration_min: null, rest_between_min: 1.5, note: 'Lourd' })
  assert.equal(cardio!.label, 'Retour au calme')

  assert.deepEqual(created('session_blocks').map(b => [b.session_id, b.position, b.block_type, b.block_id]), [
    [muscu!.id, 0, 'block_strength', strength!.id],
    [muscu!.id, 1, 'block_cardio', cardio!.id],
    [circuitSession!.id, 0, 'block_circuit', circuit!.id],
  ])
  assert.deepEqual(created('block_strength_exercises').map(e => [e.block_strength_id, e.exercise_id, e.position, e.sets, e.reps, e.weight_kg, e.note]), [
    [strength!.id, 18, 0, 4, 5, null, 'RIR 2'],
    [strength!.id, 4, 1, 3, 6, 80, null],
  ])
  assert.deepEqual(created('block_circuit_stations').map(s => [s.block_circuit_id, s.station_id, s.distance_m, s.note]), [[circuit!.id, 6, 30, '30-40 m']])
})

test('copyWeek ne modifie pas la source et ne copie pas les autres semaines', async () => {
  const { api, tables } = fakeDirectus()
  await copyWeek(api, 10, { planId: 1, weekNumber: 9 })
  for (const [collection, rows] of Object.entries(SEED)) {
    assert.deepEqual(tables[collection]!.filter(row => (row.id as number) < 1000), rows, collection)
  }
  assert.equal(tables.block_strength!.length, 3) // les deux de départ, plus la copie du bloc de la semaine 3
})

test('copyWeek copie une semaine sans séance', async () => {
  const { api, created, tables } = fakeDirectus()
  tables.weeks!.push({ id: 12, plan_id: 1, week_number: 5, phase: 3, theme: null, is_deload: false, week_note: null })
  const result = await copyWeek(api, 12, { planId: 1, weekNumber: 6 })
  assert.deepEqual([result.sessions, result.blocks, created('weeks').length, created('sessions').length], [0, 0, 1, 0])
})

test('copyWeek s\'arrête si Directus ne renvoie pas toutes les lignes créées', async () => {
  const { api } = fakeDirectus({ dropOne: 'sessions' })
  await assert.rejects(copyWeek(api, 10, { planId: 1, weekNumber: 9 }), /Copie interrompue/)
  const missing = fakeDirectus()
  await assert.rejects(copyWeek(missing.api, 999, { planId: 1, weekNumber: 9 }), /introuvable/)
})

// ── copie d'un plan ──────────────────────────────────────────────────────────
test('copyPlan crée un brouillon avec toutes les semaines, dans l\'ordre, et dit où il en est', async () => {
  const { api, created } = fakeDirectus()
  const progress: string[] = []
  const planId = await copyPlan(api, 1, { title: 'Solo (copie)' }, (done, total) => progress.push(`${done}/${total}`))

  const [plan] = created('plans')
  assert.deepEqual(plan, {
    id: planId, title: 'Solo (copie)', description: 'Prépa', start_date: '2026-10-05', sport: 'hyrox', level: 'open',
    status: 'draft', plan_type: 'open_solo', total_weeks: 19, phase_names: { 1: 'Force' },
  })
  assert.deepEqual(created('weeks').map(w => [w.plan_id, w.week_number, w.theme, w.is_deload]), [[planId, 3, 'Volume', false], [planId, 4, 'Décharge', true]])
  assert.equal(created('sessions').length, 4)
  assert.equal(created('block_strength_exercises').length, 3)
  assert.deepEqual(progress, ['0/2', '1/2', '2/2'])
})
