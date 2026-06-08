const PLAN_WEEKS = 19
const MIN_WEEKS = 12
const MS_PER_DAY = 86_400_000
const MS_PER_WEEK = 7 * MS_PER_DAY

// Lundi de la semaine contenant une date donnée
function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=dim, 1=lun, ...
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function useAthleteSchedule() {
  // Date de début de la semaine N du plan (1-indexed)
  function weekStartDate(raceDate: string, weekNumber: number): Date {
    const race = weekStart(new Date(raceDate))
    const offsetWeeks = PLAN_WEEKS - weekNumber
    return new Date(race.getTime() - offsetWeeks * MS_PER_WEEK)
  }

  // Numéro de semaine du plan (1-19) pour une date donnée. Peut être < 1 ou > 19.
  function weekForDate(raceDate: string, date: Date = new Date()): number {
    const race = weekStart(new Date(raceDate))
    const target = weekStart(date)
    const diffWeeks = Math.round((race.getTime() - target.getTime()) / MS_PER_WEEK)
    return PLAN_WEEKS - diffWeeks
  }

  // Semaine courante de l'athlète (aujourd'hui)
  function currentWeek(raceDate: string): number {
    return weekForDate(raceDate, new Date())
  }

  // Date de début du plan (semaine 1, lundi)
  function planStartDate(raceDate: string): Date {
    return weekStartDate(raceDate, 1)
  }

  // Nombre de semaines non couvertes si l'athlète commence aujourd'hui
  function weeksSkipped(raceDate: string): number {
    const cw = currentWeek(raceDate)
    if (cw <= 1) return 0
    return Math.max(0, cw - 1)
  }

  // Nombre de semaines restantes (depuis aujourd'hui jusqu'à la fin)
  function weeksRemaining(raceDate: string): number {
    const cw = currentWeek(raceDate)
    return Math.max(0, PLAN_WEEKS - cw + 1)
  }

  // Jours restants avant la date de course
  function daysUntilRace(raceDate: string): number {
    const race = new Date(raceDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.ceil((race.getTime() - today.getTime()) / MS_PER_DAY)
  }

  // false si moins de MIN_WEEKS semaines restantes
  function isValid(raceDate: string): boolean {
    return weeksRemaining(raceDate) >= MIN_WEEKS
  }

  // Message d'info pour l'UI du drawer
  function scheduleInfo(raceDate: string): { message: string; valid: boolean } {
    const remaining = weeksRemaining(raceDate)
    const skipped = weeksSkipped(raceDate)
    const startWeek = currentWeek(raceDate)

    if (!isValid(raceDate)) {
      return {
        message: `⚠ Seulement ${remaining} semaine${remaining > 1 ? 's' : ''} — minimum ${MIN_WEEKS} requises`,
        valid: false,
      }
    }
    if (skipped === 0) {
      return { message: 'Plan complet — 19 semaines couvertes.', valid: true }
    }
    return {
      message: `Plan démarrera à la semaine ${startWeek} (J-${daysUntilRace(raceDate)}). Semaines 1 à ${skipped} non couvertes.`,
      valid: true,
    }
  }

  return {
    weekStartDate,
    weekForDate,
    currentWeek,
    planStartDate,
    weeksSkipped,
    weeksRemaining,
    daysUntilRace,
    isValid,
    scheduleInfo,
  }
}
