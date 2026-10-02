import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDirectus, isAuthError } from '@/composables/useDirectus'
import type { PlanFields } from '@/composables/useDirectus'
import { copyPlan, copyWeek } from '@/utils/duplicate'
import { useRouter } from 'vue-router'
import type { Plan, Session, ResolvedBlock, Week } from '@/types'

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

  async function updatePlan(id: number, data: PlanFields) {
    const updated = await directus.updatePlan(id, data) as Plan
    const idx = plans.value.findIndex((p) => p.id === id)
    if (idx !== -1) plans.value[idx] = { ...plans.value[idx], ...updated }
    if (currentPlan.value?.id === id) currentPlan.value = { ...currentPlan.value, ...updated }
    return updated
  }

  // ── Création et copie ──────────────────────────────────────────────────────

  /** Nouveau plan, sans semaine */
  async function createPlan(data: PlanFields): Promise<Plan> {
    const created = { ...(await directus.createCollectionItem('plans', { ...data })) as Plan, weeks: [] }
    plans.value.push(created)
    return created
  }

  const nextWeekNumber = (plan: Plan): number => Math.max(0, ...plan.weeks.map(w => w.week_number)) + 1

  /** Semaine vide en fin du plan courant, dans la phase de la dernière semaine */
  async function addWeek(): Promise<Week> {
    const plan = currentPlan.value
    if (!plan) throw new Error('Aucun plan chargé')
    const last = [...plan.weeks].sort((a, b) => a.week_number - b.week_number).at(-1)
    const created = await directus.createCollectionItem('weeks', {
      plan_id: plan.id,
      week_number: nextWeekNumber(plan),
      phase: last?.phase ?? 1,
      theme: null,
      is_deload: false,
      week_note: null,
    }) as Week
    const week = { ...created, sessions: [] }
    plan.weeks.push(week)
    return week
  }

  /** Copie une semaine du plan courant en fin de plan, avec ses séances et leurs blocs. Renvoie la nouvelle semaine. */
  async function duplicateWeek(weekId: number): Promise<Week | null> {
    const plan = currentPlan.value
    if (!plan) throw new Error('Aucun plan chargé')
    const copy = await copyWeek(directus.copyApi, weekId, { planId: plan.id, weekNumber: nextWeekNumber(plan) })
    await loadPlan(plan.id)
    return getWeekById(copy.weekId)
  }

  /** Copie un plan et toutes ses semaines dans un brouillon « Titre (copie) ». Renvoie son identifiant. */
  async function duplicatePlan(plan: Plan, onProgress?: (done: number, total: number) => void): Promise<number> {
    try {
      return await copyPlan(directus.copyApi, plan.id, { title: `${plan.title} (copie)` }, onProgress)
    } finally {
      // Même interrompue, la copie a créé un plan : la liste doit le montrer
      plans.value = await directus.fetchPlans()
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
    updatePlan,
    createPlan,
    addWeek,
    duplicateWeek,
    duplicatePlan,
    getWeekById,
  }
})
