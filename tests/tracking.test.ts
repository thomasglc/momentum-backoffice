import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planStartFor, planStatus, todayIso } from '../src/utils/planCalendar.ts'
import {
  weekDays, planTotals, planTimeline, exerciseProgress, summarizeSets, sessionSets, formatHours, formatTonnage,
} from '../src/utils/progress.ts'
import { toProgressWeeks, trackAthlete, relativeDay, compareTracking } from '../src/utils/tracking.ts'
import type { Plan, SessionCompletion } from '../src/types/index.ts'

// ── Plan d'essai, tel que Directus le renvoie : 3 semaines écrites sur 4, début le lundi 5 octobre 2026 ──
const session = (id: number, day: string, extra: Record<string, unknown> = {}) => ({
  id, week_id: 0, day, type: 'strength', optional: false, title: `Séance ${id}`, description: null,
  duration_min: 60, intensity_score: null, focus: null, coach_tip: null, slug: null, ...extra,
})
// Muscu lundi et mercredi, mobilité optionnelle le vendredi
const week = (n: number) => ({
  id: n, plan_id: 5, week_number: n, phase: 1, theme: 'Force', is_deload: n === 3, week_note: null,
  sessions: [session(n * 10 + 1, 'Lundi'), session(n * 10 + 2, 'Mercredi'), session(n * 10 + 3, 'Vendredi', { type: 'mobility', optional: true, duration_min: 20 })],
})
const PLAN = {
  id: 5, title: 'Solo', description: null, start_date: '2026-09-01', sport: 'hyrox', level: 'open', status: 'published',
  plan_type: 'open_solo', total_weeks: 4, phase_names: null, weeks: [week(1), week(2), week(3)],
} as unknown as Plan
const RACE = '2026-10-31' // samedi de la semaine 4 : le plan de cet athlète commence le lundi 5 octobre
const done = (sessionId: number, at: string, extra: Record<string, unknown> = {}): SessionCompletion => ({
  id: sessionId, athlete_profile_id: 1, session_id: sessionId, completed_at: at, duration_sec: null, distance_km: null, ...extra,
})
const track = (completions: SessionCompletion[], today: string, extra: Record<string, unknown> = {}) =>
  trackAthlete({ raceDate: RACE, plan: PLAN, completions, lastSetLogAt: null, ...extra }, today)

// ── calendrier (porté de l'app athlète) ──────────────────────────────────────
test('le plan d\'un athlète commence en remontant depuis sa semaine de course', () => {
  assert.equal(planStartFor({ raceDate: RACE, totalWeeks: 4, planStartDate: '2026-09-01' }), '2026-10-05')
  assert.equal(planStartFor({ raceDate: null, totalWeeks: 4, planStartDate: '2026-09-01' }), '2026-09-01')
  assert.deepEqual(planStatus({ startDate: '2026-10-05', totalWeeks: 4, raceDate: RACE }, '2026-10-14'),
    { status: 'running', weekNumber: 2, daysToStart: 0, daysToRace: 17 })
  assert.equal(todayIso(new Date(2026, 9, 2, 23, 30)), '2026-10-02')
})

// ── passage des données Directus aux règles de progression ──────────────────
test('toProgressWeeks date les semaines pour l\'athlète et normalise les séances', () => {
  const weeks = toProgressWeeks(PLAN, '2026-10-05')
  assert.equal(weeks.length, 3)
  assert.deepEqual([weeks[1]!.weekNumber, weeks[1]!.startDate, weeks[1]!.endDate, weeks[2]!.isDeload], [2, '2026-10-12', '2026-10-18', true])
  assert.deepEqual(weeks[0]!.sessions[2], { id: 13, day: 'Vendredi', type: 'mobility', optional: true, title: 'Séance 13', duration: 20 })
  assert.equal(toProgressWeeks(PLAN, null)[0]!.startDate, null)
})

// ── ligne de suivi d'un athlète ──────────────────────────────────────────────
test('trackAthlete : plan en cours, semaine du jour, assiduité, dernière activité', () => {
  const t = track([done(11, '2026-10-05T18:00:00Z'), done(12, '2026-10-07T18:00:00Z'), done(21, '2026-10-12T18:00:00Z')], '2026-10-14')
  assert.equal(t.startDate, '2026-10-05')
  assert.deepEqual([t.state?.status, t.state?.weekNumber, t.totalWeeks], ['running', 2, 4])
  assert.equal(t.week?.weekNumber, 2)
  assert.deepEqual(t.completion, { done: 1, total: 2, complete: false })
  assert.deepEqual(t.days.map(d => d.state), ['done', 'rest', 'todo', 'rest', 'bonus', 'rest', 'rest'])
  assert.deepEqual([t.totals.sessionsDone, t.totals.due, t.totals.adherence], [3, 3, 100])
  assert.deepEqual([t.lastActivity, t.daysSinceActivity, t.activeThisWeek, t.needsFollowUp], ['2026-10-12', 2, true, false])
})
test('trackAthlete : à relancer après 7 jours sans activité, plan en cours seulement', () => {
  assert.equal(track([done(11, '2026-10-05T18:00:00Z')], '2026-10-13').needsFollowUp, true)   // 8 jours
  assert.equal(track([done(11, '2026-10-05T18:00:00Z')], '2026-10-11').needsFollowUp, false)  // 6 jours
  assert.equal(track([], '2026-10-15').needsFollowUp, true)    // jamais actif, plan commencé depuis 10 jours
  assert.equal(track([], '2026-10-08').needsFollowUp, false)   // jamais actif, plan commencé depuis 3 jours
  assert.equal(track([], '2026-10-01').needsFollowUp, false)   // plan pas commencé
  assert.equal(track([], '2026-12-01').needsFollowUp, false)   // plan terminé
})
test('trackAthlete : la dernière activité est la plus récente entre validation et série enregistrée', () => {
  const t = track([done(11, '2026-10-05T18:00:00Z')], '2026-10-14', { lastSetLogAt: '2026-10-12T19:30:00Z' })
  assert.deepEqual([t.lastActivity, t.daysSinceActivity, t.needsFollowUp], ['2026-10-12', 2, false])
  assert.equal(track([], '2026-10-14').lastActivity, null)
})
test('trackAthlete : sans date de course ni plan, pas de calendrier', () => {
  const noCalendar = trackAthlete({ raceDate: null, plan: { ...PLAN, start_date: null, total_weeks: null }, completions: [done(11, '2026-10-05T18:00:00Z')], lastSetLogAt: null }, '2026-10-14')
  assert.deepEqual([noCalendar.state, noCalendar.totals.adherence, noCalendar.totals.sessionsDone, noCalendar.needsFollowUp], [null, null, 1, false])
  const noPlan = trackAthlete({ raceDate: RACE, plan: null, completions: [], lastSetLogAt: null }, '2026-10-14')
  assert.deepEqual([noPlan.state, noPlan.weeks.length, noPlan.week], [null, 0, null])
})
test('trackAthlete : avant le début et après la fin du plan', () => {
  assert.deepEqual([track([], '2026-10-01').state?.status, track([], '2026-10-01').state?.daysToStart], ['before', 4])
  assert.equal(track([], '2026-11-05').state?.status, 'done')
})
test('relativeDay dit depuis quand, compareTracking met en tête les plans en cours à relancer', () => {
  assert.deepEqual([0, 1, 5, 13, 21, 70, null].map(relativeDay), ['aujourd\'hui', 'hier', 'il y a 5 j', 'il y a 13 j', 'il y a 3 sem.', 'il y a 10 sem.', 'jamais'])
  const running = track([done(11, '2026-10-12T18:00:00Z')], '2026-10-14')
  const late = track([], '2026-10-15')
  const before = track([], '2026-10-01')
  const over = track([], '2026-12-01')
  assert.ok(compareTracking(late, running) < 0)
  assert.ok(compareTracking(running, before) < 0)
  assert.ok(compareTracking(before, over) < 0)
})

// ── règles de progression (portées de l'app athlète) ─────────────────────────
const WEEKS = toProgressWeeks(PLAN, '2026-10-05')
const isDone = (...ids: number[]) => (id: number) => ids.includes(id)

test('weekDays, planTotals et planTimeline suivent les règles de l\'app', () => {
  assert.deepEqual(weekDays(WEEKS[0]!, isDone(11), '2026-10-08').map(d => d.state), ['done', 'rest', 'late', 'rest', 'bonus', 'rest', 'rest'])
  const details: Record<number, { durationSec: number | null; distanceKm: number | null }> = { 11: { durationSec: 4500, distanceKm: 8.5 } }
  assert.deepEqual(planTotals(WEEKS, isDone(11, 13), '2026-10-14', id => details[id] ?? null),
    { sessionsDone: 2, due: 3, dueDone: 1, adherence: 33, minutes: 95, km: 8.5 })
  assert.deepEqual(planTimeline(WEEKS, 4, isDone(11, 12, 21), { status: 'running', weekNumber: 3 }).map(e => e.state), ['done', 'partial', 'current', 'upcoming'])
  assert.equal(planTimeline(WEEKS, 4, isDone(), { status: 'running', weekNumber: 3 })[3]!.written, false)
})

const set = (exerciseId: number, name: string, sessionId: number, date: string, weightKg: number | null, reps: number | null, setNumber = 1) =>
  ({ exerciseId, name, sessionId, setNumber, weightKg, reps, durationSec: null, date })

test('exerciseProgress, sessionSets et summarizeSets résument les séries', () => {
  const sets = [
    set(18, 'Front Squat', 11, '2026-10-05T18:00:00Z', 60, 5, 1), set(18, 'Front Squat', 11, '2026-10-05T18:05:00Z', 62.5, 5, 2),
    set(18, 'Front Squat', 21, '2026-10-12T18:00:00Z', 65, 5, 1), set(18, 'Front Squat', 21, '2026-10-12T18:05:00Z', 65, 4, 2),
    set(10, 'Pull-up', 21, '2026-10-12T18:20:00Z', null, 9, 1),
  ]
  assert.deepEqual(exerciseProgress(sets).map(p => [p.name, p.unit, p.first, p.last, p.sessions]), [['Front Squat', 'kg', 62.5, 65, 2], ['Pull-up', 'reps', 9, 9, 1]])
  assert.deepEqual(sessionSets(sets, 21), [{ exerciseId: 18, name: 'Front Squat', summary: '65 kg × 5, 4' }, { exerciseId: 10, name: 'Pull-up', summary: '9 reps' }])
  assert.equal(summarizeSets(sets.filter(s => s.sessionId === 11)), '60 kg × 5 · 62,5 kg × 5')
  assert.deepEqual(sessionSets(sets, 99), [])
})
test('formatHours et formatTonnage', () => {
  assert.deepEqual([formatHours(45), formatHours(580), formatTonnage(850), formatTonnage(14200)], ['45 min', '9 h 40', '850 kg', '14,2 t'])
})
