import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDirectus } from '@/composables/useDirectus'
import type { Plan, Session, ResolvedBlock } from '@/types'

export const usePlanStore = defineStore('plan', () => {
  const plans = ref<Plan[]>([])
  const currentPlan = ref<Plan | null>(null)
  const currentSession = ref<Session | null>(null)
  const currentBlocks = ref<ResolvedBlock[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const directus = useDirectus()

  async function loadPlans() {
    isLoading.value = true
    error.value = null
    try {
      plans.value = await directus.fetchPlans()
    } catch {
      error.value = 'Erreur chargement plans'
    } finally {
      isLoading.value = false
    }
  }

  async function loadPlan(id: number) {
    isLoading.value = true
    error.value = null
    try {
      const plan = await directus.fetchPlan(id)
      // eslint-disable-next-line no-console
      console.log('[planStore] plan loaded:', plan)
      // eslint-disable-next-line no-console
      console.log('[planStore] weeks count:', (plan as any).weeks?.length)
      // eslint-disable-next-line no-console
      console.log('[planStore] first week sessions:', (plan as any).weeks?.[0]?.sessions)
      currentPlan.value = plan
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[planStore] loadPlan error:', e)
      error.value = 'Erreur chargement plan'
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
    } catch {
      error.value = 'Erreur chargement session'
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
