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
    } catch (e) {
      error.value = 'Erreur chargement plans'
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
      const blocks = (session as any).blocks
      if (blocks && Array.isArray(blocks)) {
        const resolved = await Promise.all(
          [...blocks]
            .sort((a: any, b: any) => a.position - b.position)
            .map(async (sb: any) => ({
              meta: sb,
              data: await directus.fetchBlock(sb.block_type, sb.block_id),
            }))
        )
        currentBlocks.value = resolved
      }
    } catch (e) {
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
