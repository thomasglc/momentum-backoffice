import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createDirectus, rest, authentication,
  readItems, createItem, updateItem, deleteItem,
  readUsers, createUser, updateUser, deleteUser, readRoles,
} from '@directus/sdk'
import type { AthleteView, AthleteProfile, AthleteUser } from '@/types'
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

// L'ID du rôle "Athlète" est configuré en variable d'env (Directus v21 ne supporte pas
// le filtre API sur les noms de rôles accentués de manière fiable)
const ATHLETE_ROLE_ID = import.meta.env.VITE_ATHLETE_ROLE_ID as string | undefined

let _athleteRoleId: string | null = ATHLETE_ROLE_ID ?? null

async function getAthleteRoleId(): Promise<string | null> {
  if (_athleteRoleId) return _athleteRoleId
  // Fallback : charger tous les rôles et chercher par nom en JS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roles = await client.request(readRoles()) as any[]
  const found = roles.find((r: any) =>
    r.name?.toLowerCase().includes('athl')
  )
  _athleteRoleId = found?.id ?? null
  return _athleteRoleId
}

export const useAthleteStore = defineStore('athletes', () => {
  const athletes = ref<AthleteView[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAthletes() {
    loading.value = true
    error.value = null
    try {
      const roleId = await getAthleteRoleId()
      if (!roleId) throw new Error('Rôle Athlète introuvable dans Directus')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users = await client.request(readUsers({
        filter: { role: { _eq: roleId } } as any,
        fields: ['id', 'first_name', 'last_name', 'email'],
        sort: ['first_name', 'last_name'],
        limit: -1,
      })) as AthleteUser[]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profiles = await client.request(readItems('athlete_profiles' as any, {
        fields: ['*', 'plan_id.id', 'plan_id.title', 'plan_id.status'],
        limit: -1,
      })) as AthleteProfile[]

      athletes.value = users.map(user => ({
        user,
        profile: profiles.find(p => p.directus_user_id === user.id) ?? null,
      }))
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error.value = (e as any)?.message ?? 'Erreur lors du chargement des athlètes'
    } finally {
      loading.value = false
    }
  }

  async function createAthlete(data: {
    firstName: string
    lastName: string
    email: string
    password: string
    gender: 'homme' | 'femme' | null
    tenKmTimeSec: number | null
    planId: number
    raceDate: string | null
  }) {
    const roleId = await getAthleteRoleId()
    if (!roleId) throw new Error('Rôle Athlète introuvable')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newUser = await client.request(createUser({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      password: data.password,
      role: roleId,
    } as any)) as { id: string }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.request(createItem('athlete_profiles' as any, {
      directus_user_id: newUser.id,
      name: newUser.id,
      plan_id: data.planId,
      race_date: data.raceDate ?? null,
      gender: data.gender ?? null,
      ten_km_time_sec: data.tenKmTimeSec ?? null,
    } as any))

    await fetchAthletes()
  }

  async function updateAthlete(athleteView: AthleteView, data: {
    firstName?: string
    lastName?: string
    email?: string
    password?: string
    gender?: 'homme' | 'femme' | null
    tenKmTimeSec?: number | null
    planId?: number
    raceDate?: string | null
  }) {
    const userId = athleteView.user.id
    const profileId = athleteView.profile?.id

    const userPatch: Record<string, unknown> = {}
    if (data.firstName !== undefined) userPatch.first_name = data.firstName
    if (data.lastName !== undefined) userPatch.last_name = data.lastName
    if (data.email !== undefined) userPatch.email = data.email
    if (data.password) userPatch.password = data.password

    if (Object.keys(userPatch).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.request(updateUser(userId, userPatch as any))
    }

    if (profileId) {
      const profilePatch: Record<string, unknown> = {}
      if (data.gender !== undefined) profilePatch.gender = data.gender
      if (data.tenKmTimeSec !== undefined) profilePatch.ten_km_time_sec = data.tenKmTimeSec
      if (data.planId !== undefined) profilePatch.plan_id = data.planId
      if (data.raceDate !== undefined) profilePatch.race_date = data.raceDate

      if (Object.keys(profilePatch).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await client.request(updateItem('athlete_profiles' as any, profileId, profilePatch as any))
      }
    }

    await fetchAthletes()
  }

  async function deleteAthlete(athleteView: AthleteView) {
    if (athleteView.profile?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.request(deleteItem('athlete_profiles' as any, athleteView.profile.id))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.request(deleteUser(athleteView.user.id))
    athletes.value = athletes.value.filter(a => a.user.id !== athleteView.user.id)
  }

  return { athletes, loading, error, fetchAthletes, createAthlete, updateAthlete, deleteAthlete }
})
