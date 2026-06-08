import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readItems, createItem, updateItem, deleteItem } from '@directus/sdk'
import { createDirectus, rest, authentication } from '@directus/sdk'
import type { Athlete, AthleteAssignment, AthleteWithAssignment } from '@/types'
import { AUTH_STORAGE_KEY } from '@/composables/useDirectus'

const BASE_URL = import.meta.env.DEV
  ? `${window.location.origin}/api`
  : (import.meta.env.VITE_DIRECTUS_URL || 'http://localhost:8056')

const localStorageAuth = {
  get() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  },
  set(value: unknown) {
    if (value) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(AUTH_STORAGE_KEY)
  },
}

const client = createDirectus(BASE_URL)
  .with(authentication('json', { storage: localStorageAuth, autoRefresh: true }))
  .with(rest())

export const useAthleteStore = defineStore('athletes', () => {
  const athletes = ref<AthleteWithAssignment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAthletes() {
    loading.value = true
    error.value = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await client.request(
        readItems('athletes' as any, { fields: ['*'], sort: ['name'], limit: -1 })
      ) as Athlete[]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assignments = await client.request(
        readItems('athlete_plan_assignments' as any, {
          fields: ['*', 'plan_id.id', 'plan_id.title', 'plan_id.status'],
          limit: -1,
        })
      ) as AthleteAssignment[]

      athletes.value = raw.map(a => ({
        ...a,
        assignment: (assignments.find(asg => asg.athlete_id === a.id) ?? null) as AthleteWithAssignment['assignment'],
      }))
    } catch (e: unknown) {
      error.value = (e as any)?.message ?? 'Erreur lors du chargement des athlètes'
    } finally {
      loading.value = false
    }
  }

  async function createAthlete(data: {
    name: string
    email?: string | null
    ten_km_time_sec?: number | null
    notes?: string | null
    planId: number
    raceDate: string
    assignmentNotes?: string | null
  }) {
    const { planId, raceDate, assignmentNotes, ...athleteData } = data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newAthlete = await client.request(
      createItem('athletes' as any, athleteData as any)
    ) as Athlete

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.request(
      createItem('athlete_plan_assignments' as any, {
        athlete_id: newAthlete.id,
        plan_id: planId,
        race_date: raceDate,
        notes: assignmentNotes ?? null,
      } as any)
    )

    await fetchAthletes()
  }

  async function updateAthlete(id: number, data: {
    name?: string
    email?: string | null
    ten_km_time_sec?: number | null
    notes?: string | null
    planId?: number
    raceDate?: string
    assignmentNotes?: string | null
  }, assignmentId: number | null) {
    const { planId, raceDate, assignmentNotes, ...athleteData } = data

    if (Object.keys(athleteData).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.request(updateItem('athletes' as any, id, athleteData as any))
    }

    if (assignmentId && (planId !== undefined || raceDate !== undefined)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.request(updateItem('athlete_plan_assignments' as any, assignmentId, {
        ...(planId !== undefined ? { plan_id: planId } : {}),
        ...(raceDate !== undefined ? { race_date: raceDate } : {}),
        ...(assignmentNotes !== undefined ? { notes: assignmentNotes } : {}),
      } as any))
    } else if (!assignmentId && planId && raceDate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.request(createItem('athlete_plan_assignments' as any, {
        athlete_id: id,
        plan_id: planId,
        race_date: raceDate,
        notes: assignmentNotes ?? null,
      } as any))
    }

    await fetchAthletes()
  }

  async function deleteAthlete(id: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.request(deleteItem('athletes' as any, id))
    athletes.value = athletes.value.filter(a => a.id !== id)
  }

  return { athletes, loading, error, fetchAthletes, createAthlete, updateAthlete, deleteAthlete }
})
