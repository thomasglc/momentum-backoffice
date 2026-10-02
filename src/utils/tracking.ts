// Suivi d'un athlète par le coach : passage des données Directus aux règles de progression,
// dernière activité et règle de relance (logique pure).
import type { Plan, SessionCompletion } from '../types/index.ts'
import { daysBetween, mondayOf, planStartFor, planStatus, todayIso, weekDates } from './planCalendar.ts'
import type { PlanState } from './planCalendar.ts'
import { planTotals, weekCompletion, weekDays } from './progress.ts'
import type { CompletionDetail, DayState, PlanTotals, ProgressWeek } from './progress.ts'

/** Sans activité depuis ce nombre de jours, un athlète dont le plan est en cours est à relancer */
export const FOLLOW_UP_DAYS = 7

/** Semaines Directus d'un plan → semaines datées pour un athlète (startDate : lundi de sa semaine 1) */
export function toProgressWeeks(plan: Plan, startDate: string | null): ProgressWeek[] {
  return [...(plan.weeks ?? [])]
    .sort((a, b) => a.week_number - b.week_number)
    .map(week => ({
      weekNumber: week.week_number,
      phase: week.phase ?? null,
      theme: week.theme ?? null,
      isDeload: !!week.is_deload,
      ...(startDate ? weekDates(startDate, week.week_number) : { startDate: null, endDate: null }),
      sessions: (week.sessions ?? []).map(session => ({
        id: session.id,
        day: session.day,
        type: session.type,
        optional: !!session.optional,
        title: session.title,
        duration: session.duration_min ?? 0,
      })),
    }))
}

/** Horodatage Directus → jour local 'YYYY-MM-DD' */
const localDay = (timestamp: string): string => todayIso(new Date(timestamp))

export interface AthleteTracking {
  startDate: string | null
  totalWeeks: number
  state: PlanState | null       // null : pas de plan, ou plan sans calendrier
  weeks: ProgressWeek[]
  week: ProgressWeek | null     // semaine du jour
  days: DayState[]
  completion: { done: number; total: number; complete: boolean }
  totals: PlanTotals
  lastActivity: string | null   // jour de la dernière validation ou de la dernière série
  daysSinceActivity: number | null
  activeThisWeek: boolean
  needsFollowUp: boolean
  isDone: (sessionId: number) => boolean
  detailOf: (sessionId: number) => (CompletionDetail & { completedAt: string | null }) | null
}

/** Où en est un athlète aujourd'hui, d'après son plan, sa date de course et ses validations */
export function trackAthlete(
  input: { raceDate: string | null; plan: Plan | null; completions: SessionCompletion[]; lastSetLogAt: string | null },
  today: string,
): AthleteTracking {
  const { raceDate, plan, completions, lastSetLogAt } = input
  const writtenWeeks = plan?.weeks?.length ?? 0
  const totalWeeks = plan?.total_weeks ?? writtenWeeks
  const startDate = plan
    ? planStartFor({ raceDate, totalWeeks: plan.total_weeks ?? null, planStartDate: plan.start_date })
    : null
  const state = startDate && totalWeeks > 0 ? planStatus({ startDate, totalWeeks, raceDate }, today) : null
  const weeks = plan ? toProgressWeeks(plan, startDate) : []

  const bySession = new Map(completions.map(c => [c.session_id, c]))
  const isDone = (sessionId: number): boolean => bySession.has(sessionId)
  const detailOf = (sessionId: number) => {
    const c = bySession.get(sessionId)
    return c ? { durationSec: c.duration_sec ?? null, distanceKm: c.distance_km == null ? null : Number(c.distance_km), completedAt: c.completed_at ?? null } : null
  }

  // Sans calendrier, pas de jour courant : ni retard, ni assiduité
  const calendarDay = state ? today : null
  const week = state ? weeks.find(w => w.weekNumber === state.weekNumber) ?? null : null

  const stamps = [...completions.map(c => c.completed_at), lastSetLogAt].filter((s): s is string => !!s)
  const lastActivity = stamps.length ? stamps.map(localDay).sort().at(-1)! : null
  const daysSinceActivity = lastActivity ? Math.max(0, daysBetween(lastActivity, today)) : null
  const idleDays = daysSinceActivity ?? (startDate ? daysBetween(startDate, today) : 0)

  return {
    startDate,
    totalWeeks,
    state,
    weeks,
    week,
    days: weekDays(week, isDone, calendarDay),
    completion: weekCompletion(week, isDone),
    totals: planTotals(weeks, isDone, calendarDay, detailOf),
    lastActivity,
    daysSinceActivity,
    activeThisWeek: lastActivity != null && lastActivity >= mondayOf(today),
    needsFollowUp: state?.status === 'running' && idleDays >= FOLLOW_UP_DAYS,
    isDone,
    detailOf,
  }
}

/** 0 → « aujourd'hui », 5 → « il y a 5 j », 21 → « il y a 3 sem. », null → « jamais » */
export function relativeDay(days: number | null): string {
  if (days == null) return 'jamais'
  if (days === 0) return 'aujourd\'hui'
  if (days === 1) return 'hier'
  return days < 14 ? `il y a ${days} j` : `il y a ${Math.floor(days / 7)} sem.`
}

// Ordre du tableau de suivi : à relancer, en cours, pas commencé, terminé, sans calendrier
const rank = (t: AthleteTracking): number => {
  if (!t.state) return 4
  if (t.state.status === 'running') return t.needsFollowUp ? 0 : 1
  return t.state.status === 'before' ? 2 : 3
}
export function compareTracking(a: AthleteTracking, b: AthleteTracking): number {
  return rank(a) - rank(b)
}
