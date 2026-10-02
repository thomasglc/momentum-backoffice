// Calendrier d'un plan pour un athlète (logique pure, portée de l'app athlète : src/utils/planCalendar.js).
// Les dates sont des chaînes 'YYYY-MM-DD'. Les calculs se font en UTC : ni fuseau ni heure d'été.

const DAY_MS = 86_400_000

const toMs = (iso: string): number => {
  const [y = 0, m = 1, d = 1] = String(iso).slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export const daysBetween = (from: string, to: string): number => Math.round((toMs(to) - toMs(from)) / DAY_MS)

/** Date du jour en heure locale ; sert aussi à ramener un horodatage Directus à son jour local */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(iso: string, n: number): string {
  return toIso(toMs(iso) + n * DAY_MS)
}

export function mondayOf(iso: string): string {
  const ms = toMs(iso)
  const sinceMonday = (new Date(ms).getUTCDay() + 6) % 7 // lundi = 0, dimanche = 6
  return toIso(ms - sinceMonday * DAY_MS)
}

/**
 * Lundi de la semaine 1 pour cet athlète : on remonte depuis la semaine de sa course.
 * Sans date de course ou sans longueur de plan, on retombe sur la date de début commune du plan.
 */
export function planStartFor(input: { raceDate: string | null; totalWeeks: number | null; planStartDate: string | null }): string | null {
  const { raceDate, totalWeeks, planStartDate } = input
  if (raceDate && totalWeeks && totalWeeks > 0) return addDays(mondayOf(raceDate), -(totalWeeks - 1) * 7)
  return planStartDate ? String(planStartDate).slice(0, 10) : null
}

/** Lundi et dimanche de la semaine n (1 = première semaine) */
export function weekDates(startDate: string, weekNumber: number): { startDate: string; endDate: string } {
  const start = addDays(startDate, (weekNumber - 1) * 7)
  return { startDate: start, endDate: addDays(start, 6) }
}

export interface PlanState {
  status: 'before' | 'running' | 'done'
  weekNumber: number
  daysToStart: number
  daysToRace: number | null
}

/** Où en est le plan à la date `today` : pas commencé, en cours ou terminé */
export function planStatus(plan: { startDate: string; totalWeeks: number; raceDate: string | null }, today: string): PlanState {
  const sinceStart = daysBetween(plan.startDate, today)
  const week = Math.floor(sinceStart / 7) + 1
  let status: PlanState['status'] = 'running'
  if (sinceStart < 0) status = 'before'
  else if (week > plan.totalWeeks) status = 'done'
  return {
    status,
    weekNumber: Math.max(1, Math.min(week, plan.totalWeeks)),
    daysToStart: Math.max(0, -sinceStart),
    daysToRace: plan.raceDate ? daysBetween(today, plan.raceDate) : null,
  }
}
