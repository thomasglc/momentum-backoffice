import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createDirectus, rest, authentication,
  readItems, deleteItem,
} from '@directus/sdk'
import type { WaitingListEntry } from '@/types'
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

export const useWaitingListStore = defineStore('waitingList', () => {
  const entries = ref<WaitingListEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchEntries() {
    loading.value = true
    error.value = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client.request(readItems('waiting_list' as any, {
        fields: ['id', 'email', 'date_created'],
        sort: ['-date_created'],
        limit: -1,
      })) as WaitingListEntry[]
      entries.value = result
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error.value = (e as any)?.message ?? 'Erreur lors du chargement de la file d\'attente'
    } finally {
      loading.value = false
    }
  }

  async function deleteEntry(id: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.request(deleteItem('waiting_list' as any, id))
    entries.value = entries.value.filter(e => e.id !== id)
  }

  return { entries, loading, error, fetchEntries, deleteEntry }
})
