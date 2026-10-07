// Règles de progression d'un athlète dans son plan (logique pure).
// Portées de l'app athlète (src/utils/progress.js, setLogs.js) : mêmes règles des deux côtés.
import { addDays } from './planCalendar.ts'
import type { PlanState } from './planCalendar.ts'
import type { SetLogRow } from '../types/index.ts'

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const

export interface ProgressSession {
  id: number
  day: string
  type: string
  optional: boolean
  title: string
  duration: number // minutes prévues, 0 si non renseignée
}

export interface ProgressWeek {
  weekNumber: number
  phase: number | null
  theme: string | null
  isDeload: boolean
  startDate: string | null // lundi de la semaine pour cet athlète ; null sans calendrier
  endDate: string | null
  sessions: ProgressSession[]
}

export interface CompletionDetail {
  durationSec: number | null
  distanceKm: number | null
}

// Une série de muscu, ou un tour sur une station (exerciseId ou stationId, jamais les deux)
export interface ProgressSet {
  exerciseId: number | null
  stationId?: number | null
  /** Nom de l'exercice ou de la station */
  name: string | null
  sessionId: number | null
  setNumber: number
  weightKg: number | null
  reps: number | null
  durationSec: number | null
  distanceM?: number | null
  date: string | null
}

export type DayStatus = 'done' | 'todo' | 'late' | 'rest' | 'bonus'
export interface DayState {
  day: string
  letter: string
  date: string | null
  isToday: boolean
  state: DayStatus
  sessions: ProgressSession[]
}

type IsDone = (sessionId: number) => boolean

const round1 = (n: number): number => Math.round(n * 10) / 10
// Les dates sont des chaînes ISO : l'ordre alphabétique est l'ordre chronologique.
const byDate = (a: { date: string | null }, b: { date: string | null }): number => String(a.date ?? '').localeCompare(String(b.date ?? ''))

/** Date d'une séance : lundi de sa semaine + son jour. null sans calendrier ou pour un jour inconnu. */
export function sessionDate(weekStart: string | null, day: string): string | null {
  const index = (DAYS as readonly string[]).indexOf(day)
  return weekStart && index >= 0 ? addDays(weekStart, index) : null
}

/** Séances obligatoires validées d'une semaine. Les optionnelles ne comptent ni pour ni contre. */
export function weekCompletion(week: ProgressWeek | null, isDone: IsDone): { done: number; total: number; complete: boolean } {
  const mandatory = (week?.sessions ?? []).filter(s => !s.optional)
  const done = mandatory.filter(s => isDone(s.id)).length
  return { done, total: mandatory.length, complete: mandatory.length > 0 && done === mandatory.length }
}

/**
 * Les sept jours d'une semaine. 'done' : séances obligatoires du jour validées ; 'late' : jour passé,
 * non validé ; 'rest' : aucune séance ; 'bonus' : seulement des séances optionnelles, non validées.
 */
export function weekDays(week: ProgressWeek | null, isDone: IsDone, today: string | null): DayState[] {
  return DAYS.map((day, index) => {
    const sessions = (week?.sessions ?? []).filter(s => s.day === day)
    const mandatory = sessions.filter(s => !s.optional)
    const date = week?.startDate ? addDays(week.startDate, index) : null
    let state: DayStatus
    if (!sessions.length) state = 'rest'
    else if (!mandatory.length) state = sessions.some(s => isDone(s.id)) ? 'done' : 'bonus'
    else if (mandatory.every(s => isDone(s.id))) state = 'done'
    else state = date && today && date < today ? 'late' : 'todo'
    return { day, letter: day.charAt(0), date, isToday: date != null && date === today, state, sessions }
  })
}

export interface PlanTotals {
  sessionsDone: number
  due: number
  dueDone: number
  adherence: number | null
  minutes: number
  km: number
}

/**
 * Totaux depuis le début du plan. Une séance obligatoire est échue quand son jour est passé,
 * ou dès qu'elle est validée. Les minutes sont réelles quand la durée est notée, prévues sinon.
 */
export function planTotals(
  weeks: ProgressWeek[],
  isDone: IsDone,
  today: string | null,
  detailOf: (sessionId: number) => CompletionDetail | null = () => null,
): PlanTotals {
  let sessionsDone = 0
  let due = 0
  let dueDone = 0
  let minutes = 0
  let km = 0
  for (const week of weeks) {
    for (const session of week.sessions) {
      const done = isDone(session.id)
      if (done) {
        const detail = detailOf(session.id)
        sessionsDone++
        minutes += detail?.durationSec != null ? detail.durationSec / 60 : session.duration
        km += detail?.distanceKm ?? 0
      }
      if (session.optional) continue
      const date = sessionDate(week.startDate, session.day)
      if (done || (today && date && date < today)) due++
      if (done) dueDone++
    }
  }
  return {
    sessionsDone,
    due,
    dueDone,
    adherence: today && due ? Math.round((dueDone / due) * 100) : null,
    minutes: Math.round(minutes),
    km: round1(km),
  }
}

export type TimelineState = 'done' | 'partial' | 'missed' | 'current' | 'upcoming' | 'none'
export interface TimelineEntry {
  number: number
  written: boolean
  phase: number | null
  theme: string | null
  isDeload: boolean
  startDate: string | null
  endDate: string | null
  done: number
  total: number
  state: TimelineState
}

/** Frise du plan : une case par semaine, écrite dans Directus ou non. */
export function planTimeline(
  weeks: ProgressWeek[],
  totalWeeks: number,
  isDone: IsDone,
  at: { status: PlanState['status'] | null; weekNumber: number },
): TimelineEntry[] {
  const byNumber = new Map(weeks.map(w => [w.weekNumber, w]))
  const count = Math.max(totalWeeks || 0, 0, ...byNumber.keys())
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const week = byNumber.get(number) ?? null
    const { done, total, complete } = weekCompletion(week, isDone)
    const past = at.status === 'done' || (at.status === 'running' && number < at.weekNumber)
    let state: TimelineState = 'upcoming'
    if (at.status === 'running' && number === at.weekNumber) state = 'current'
    else if (past || at.status == null) {
      if (complete) state = 'done'
      else if (done > 0) state = 'partial'
      else if (past) state = total > 0 ? 'missed' : 'none'
    }
    return {
      number,
      written: week != null,
      phase: week?.phase ?? null,
      theme: week?.theme ?? null,
      isDeload: !!week?.isDeload,
      startDate: week?.startDate ?? null,
      endDate: week?.endDate ?? null,
      done,
      total,
      state,
    }
  })
}

// ── Séries ───────────────────────────────────────────────────────────────────

export const formatNumber = (n: number | null): string => (n == null ? '' : String(n).replace('.', ','))

/** Série enregistrée (set_logs, exercice et station dépliés) → série du suivi */
export function toProgressSet(log: SetLogRow): ProgressSet {
  const ref = (value: SetLogRow['exercise_id'] | undefined) =>
    (value !== null && typeof value === 'object' ? value : { id: value ?? null, name: null })
  const exercise = ref(log.exercise_id)
  const station = ref(log.station_id)
  return {
    exerciseId: exercise.id,
    stationId: station.id,
    name: exercise.name ?? station.name,
    sessionId: log.session_id,
    setNumber: log.set_number,
    weightKg: log.weight_kg,
    reps: log.reps,
    durationSec: log.duration_sec,
    distanceM: log.distance_m ?? null,
    date: log.date_created,
  }
}

// Ce qu'une série fait travailler : un exercice ou une station, qui ont chacun leur numérotation
const refOf = (s: ProgressSet): string | null => (s.stationId != null ? `s${s.stationId}` : s.exerciseId != null ? `e${s.exerciseId}` : null)
const nameOf = (own: ProgressSet[]): string => own.find(s => s.name)?.name ?? (own[0]?.stationId != null ? 'Station' : 'Exercice')

/** Résumé compact des séries d'un exercice : "62,5 kg × 5, 5, 5, 4", "10, 9 reps", "45, 40 s", "24 kg × 30, 40 m" */
export function summarizeSets(sets: ProgressSet[]): string {
  // Les séries consécutives de même charge sont regroupées
  const groups: { weight: number | null; sets: ProgressSet[] }[] = []
  for (const s of [...sets].sort((a, b) => a.setNumber - b.setNumber)) {
    const weight = s.weightKg || null
    const last = groups.at(-1)
    if (last && last.weight === weight) last.sets.push(s)
    else groups.push({ weight, sets: [s] })
  }
  return groups.map(({ weight, sets: own }) => {
    // Ce que la série compte : des mètres (portés, ergomètres), des secondes (gainage), sinon des reps
    const inMeters = own.every(s => s.reps == null && s.distanceM != null)
    const timed = !inMeters && own.every(s => s.reps == null && s.durationSec != null)
    const values = own.map(s => (inMeters ? s.distanceM : timed ? s.durationSec : s.reps) ?? '—').join(', ')
    const unit = inMeters ? ' m' : timed ? ' s' : weight ? '' : ' reps'
    return weight ? `${formatNumber(weight)} kg × ${values}${unit}` : `${values}${unit}`
  }).join(' · ')
}

/** Séries d'une séance, regroupées par exercice ou par station dans l'ordre où ils ont été faits */
export function sessionSets(sets: ProgressSet[], sessionId: number): { key: string; name: string; summary: string }[] {
  const byRef = new Map<string, ProgressSet[]>()
  for (const s of sets.filter(set => set.sessionId === sessionId).sort(byDate)) {
    // Exercice et station disparus du catalogue : les séries restent comptées, sous un même intitulé
    const key = refOf(s) ?? 'inconnu'
    if (!byRef.has(key)) byRef.set(key, [])
    byRef.get(key)!.push(s)
  }
  return [...byRef].map(([key, own]) => ({ key, name: nameOf(own), summary: summarizeSets(own) }))
}

export type LoadUnit = 'kg' | 'reps' | 'm' | 's'
export interface ExerciseProgress {
  /** Exercice ("e18") ou station ("s6") */
  key: string
  name: string
  unit: LoadUnit
  first: number
  last: number
  best: number
  sessions: number
  lastDate: string | null
}

/**
 * Progression par exercice et par station, le plus récemment travaillé d'abord (puis par nom).
 * La valeur d'une séance est sa plus lourde série ; sans charge, le plus de reps, sinon la plus longue distance ;
 * en gainage, la plus longue tenue.
 */
export function exerciseProgress(sets: ProgressSet[]): ExerciseProgress[] {
  const byRef = new Map<string, ProgressSet[]>()
  for (const set of sets) {
    const key = refOf(set)
    if (key == null) continue
    if (!byRef.has(key)) byRef.set(key, [])
    byRef.get(key)!.push(set)
  }

  const list = [...byRef].map(([key, own]): ExerciseProgress => {
    const unit: LoadUnit = own.some(s => (s.weightKg ?? 0) > 0) ? 'kg'
      : own.some(s => (s.reps ?? 0) > 0) ? 'reps'
        : own.some(s => (s.distanceM ?? 0) > 0) ? 'm' : 's'
    const valueOf = (s: ProgressSet): number =>
      (unit === 'kg' ? s.weightKg : unit === 'reps' ? s.reps : unit === 'm' ? s.distanceM : s.durationSec) ?? 0

    // Une série dont la séance a été supprimée (sessionId null) est rattachée à son jour
    const bySession = new Map<string, { date: string | null; value: number }>()
    for (const s of own) {
      const key = s.sessionId != null ? `s${s.sessionId}` : `d${String(s.date ?? '').slice(0, 10)}`
      const entry = bySession.get(key) ?? { date: s.date, value: 0 }
      entry.value = Math.max(entry.value, valueOf(s))
      if (byDate(s, entry) < 0) entry.date = s.date
      bySession.set(key, entry)
    }
    const sessions = [...bySession.values()].sort(byDate)
    const values = sessions.map(s => s.value)
    return {
      key,
      name: nameOf(own),
      unit,
      first: values[0] ?? 0,
      last: values.at(-1) ?? 0,
      best: Math.max(...values),
      sessions: sessions.length,
      lastDate: sessions.at(-1)?.date ?? null,
    }
  })
  const dayOf = (p: ExerciseProgress): string => String(p.lastDate ?? '').slice(0, 10)
  return list.sort((a, b) => dayOf(b).localeCompare(dayOf(a)) || a.name.localeCompare(b.name))
}

/** Volume levé : somme de charge × reps des séries */
export function totalVolumeKg(sets: ProgressSet[]): number {
  return round1(sets.reduce((sum, s) => sum + (s.weightKg && s.reps ? s.weightKg * s.reps : 0), 0))
}

/** 580 → "9 h 40", 45 → "45 min", 60 → "1 h" */
export function formatHours(minutes: number): string {
  const total = Math.round(minutes || 0)
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`
}

/** 850 → "850 kg", 14200 → "14,2 t" */
export function formatTonnage(kg: number): string {
  const rounded = Math.round(kg || 0)
  if (rounded < 1000) return `${rounded} kg`
  return `${String(Math.round(rounded / 100) / 10).replace('.', ',')} t`
}
