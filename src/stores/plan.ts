import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDirectus, isAuthError } from '@/composables/useDirectus'
import { useRouter } from 'vue-router'
import type { Plan, Session, ResolvedBlock } from '@/types'

export const usePlanStore = defineStore('plan', () => {
  const plans = ref<Plan[]>([])
  const currentPlan = ref<Plan | null>(null)
  const currentSession = ref<Session | null>(null)
  const currentBlocks = ref<ResolvedBlock[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const directus = useDirectus()
  const router = useRouter()

  function handleError(e: unknown, message: string) {
    if (isAuthError(e)) {
      localStorage.removeItem('auth_token')
      router.push('/login')
      return
    }
    error.value = message
  }

  async function loadPlans() {
    isLoading.value = true
    error.value = null
    try {
      plans.value = await directus.fetchPlans()
    } catch (e) {
      handleError(e, 'Erreur chargement plans')
    } finally {
      isLoading.value = false
    }
  }

  async function loadPlan(id: number) {
    isLoading.value = true
    error.value = null
    try {
      currentPlan.value = await directus.fetchPlan(id)
    } catch (e) {
      handleError(e, 'Erreur chargement plan')
    } finally {
      isLoading.value = false
    }
  }

  async function loadSession(id: number) {
    isLoading.value = true
    error.value = null
    currentBlocks.value = []
    try {
      const session = await directus.fetchSession(id)
      currentSession.value = session as Session
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks = (session as any).blocks
      if (blocks && Array.isArray(blocks)) {
        const resolved = await Promise.all(
          [...blocks]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((a: any, b: any) => a.position - b.position)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map(async (sb: any) => ({
              meta: sb,
              data: await directus.fetchBlock(sb.block_type, sb.block_id),
            }))
        )
        currentBlocks.value = resolved
      }
    } catch (e) {
      handleError(e, 'Erreur chargement session')
    } finally {
      isLoading.value = false
    }
  }

  function getWeekById(weekId: number) {
    return currentPlan.value?.weeks.find((w) => w.id === weekId) ?? null
  }

  return {
    plans,
    currentPlan,
    currentSession,
    currentBlocks,
    isLoading,
    error,
    loadPlans,
    loadPlan,
    loadSession,
    getWeekById,
  }
})
