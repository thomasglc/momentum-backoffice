import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useDirectus, isAuthError } from '@/composables/useDirectus'
import { useAthleteStore } from '@/stores/athletes'
import type { AthleteView, Plan, SessionCompletion } from '@/types'
import { todayIso } from '@/utils/planCalendar'
import { compareTracking, trackAthlete } from '@/utils/tracking'
import type { AthleteTracking } from '@/utils/tracking'

export interface TrackingRow {
  athlete: AthleteView
  profileId: number | null   // null : compte sans profil athlète, rien à suivre
  name: string
  plan: Plan | null
  tracking: AthleteTracking
}

const planIdOf = (athlete: AthleteView): number | null => {
  const plan = athlete.profile?.plan_id
  if (plan == null) return null
  return typeof plan === 'object' ? plan.id : plan
}

const nameOf = (athlete: AthleteView): string =>
  [athlete.user.first_name, athlete.user.last_name].filter(Boolean).join(' ') || athlete.user.email

// Suivi des athlètes par le coach : où en est chacun dans son plan, d'après ce qu'il a validé.
// Les règles sont dans utils/tracking et utils/progress.
export const useTrackingStore = defineStore('tracking', () => {
  const directus = useDirectus()
  const athleteStore = useAthleteStore()
  const router = useRouter()

  const plans = shallowRef(new Map<number, Plan>())         // plans des athlètes, avec semaines et séances
  const completions = shallowRef<SessionCompletion[]>([])
  const lastSetLogs = shallowRef<Record<number, string>>({}) // dernière série enregistrée, par profil
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const today = ref(todayIso())

  /** Charge, ou recharge en gardant l'affichage */
  async function load() {
    today.value = todayIso()
    if (status.value !== 'ready') status.value = 'loading'
    try {
      await athleteStore.fetchAthletes()
      if (athleteStore.error) throw new Error(athleteStore.error)
      const planIds = [...new Set(athleteStore.athletes.map(planIdOf).filter((id): id is number => id != null))]
      const [planList, allCompletions, lastLogs] = await Promise.all([
        Promise.all(planIds.map(id => directus.fetchPlan(id))),
        directus.fetchCompletions(),
        // Sans cette lecture, la dernière activité se limite aux validations
        directus.fetchLastSetLogs().catch(() => ({} as Record<number, string>)),
      ])
      plans.value = new Map(planList.map(plan => [plan.id, plan]))
      completions.value = allCompletions
      lastSetLogs.value = lastLogs
      status.value = 'ready'
    } catch (e) {
      if (isAuthError(e)) router.push('/login')
      status.value = 'error'
    }
  }

  const rows = computed<TrackingRow[]>(() => {
    const byProfile = new Map<number, SessionCompletion[]>()
    for (const completion of completions.value) {
      const own = byProfile.get(completion.athlete_profile_id) ?? []
      own.push(completion)
      byProfile.set(completion.athlete_profile_id, own)
    }
    return athleteStore.athletes
      .map((athlete): TrackingRow => {
        const profileId = athlete.profile?.id ?? null
        const planId = planIdOf(athlete)
        const plan = planId != null ? plans.value.get(planId) ?? null : null
        return {
          athlete,
          profileId,
          name: nameOf(athlete),
          plan,
          tracking: trackAthlete({
            raceDate: athlete.profile?.race_date ?? null,
            plan,
            completions: profileId != null ? byProfile.get(profileId) ?? [] : [],
            lastSetLogAt: profileId != null ? lastSetLogs.value[profileId] ?? null : null,
          }, today.value),
        }
      })
      .sort((a, b) => compareTracking(a.tracking, b.tracking) || a.name.localeCompare(b.name))
  })

  const rowOf = (profileId: number): TrackingRow | null => rows.value.find(row => row.profileId === profileId) ?? null

  return { status, today, rows, rowOf, load }
})
