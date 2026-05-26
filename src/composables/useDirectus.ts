import { createDirectus, rest, authentication, readItems, readItem, updateItem, withToken } from '@directus/sdk'
import type { Plan, AnyBlock, BlockType } from '@/types'

const BASE_URL = import.meta.env.DEV ? `${window.location.origin}/api` : 'http://localhost:8056'

const client = createDirectus(BASE_URL)
  .with(authentication('json'))
  .with(rest())

function getToken(): string {
  return localStorage.getItem('auth_token') ?? ''
}

// Restaure le token après un rechargement de page
const savedToken = localStorage.getItem('auth_token')
if (savedToken) {
  client.setToken(savedToken)
}

export function isAuthError(e: unknown): boolean {
  if (e && typeof e === 'object') {
    const status = (e as any)?.response?.status ?? (e as any)?.status
    return status === 401 || status === 403
  }
  return false
}

export function useDirectus() {
  async function login(email: string, password: string) {
    return client.login({ email, password })
  }

  async function logout() {
    return client.logout()
  }

  async function fetchToken(): Promise<string | null> {
    return client.getToken()
  }

  async function fetchPlans(): Promise<Plan[]> {
    return client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), readItems('plans' as any, { fields: ['*'] }))
    ) as unknown as Promise<Plan[]>
  }

  async function fetchPlan(id: number): Promise<Plan> {
    return client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), readItem('plans' as any, id, {
        fields: ['*', 'weeks.*', 'weeks.sessions.*'],
      }))
    ) as unknown as Promise<Plan>
  }

  async function fetchSession(id: number) {
    const [session, blocks] = await Promise.all([
      client.request(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withToken(getToken(), readItem('sessions' as any, id, { fields: ['*'] }))
      ),
      client.request(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withToken(getToken(), readItems('session_blocks' as any, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filter: { session_id: { _eq: id } } as any,
          fields: ['*'],
          sort: ['position'],
        }))
      ),
    ])
    return { ...(session as object), blocks }
  }

  async function fetchBlock(blockType: BlockType, blockId: number): Promise<AnyBlock> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block: any = await client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), readItem(blockType as any, blockId, { fields: ['*'] }))
    )

    if (blockType === 'block_strength') {
      const exercises = await client.request(
        withToken(getToken(), readItems('block_strength_exercises' as any, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filter: { block_strength_id: { _eq: blockId } } as any,
          fields: ['*', 'exercise_id.*'],
          sort: ['position'],
        }))
      )
      return { ...block, exercises } as unknown as AnyBlock
    }

    const stationChildMap: Partial<Record<BlockType, string>> = {
      block_circuit: 'block_circuit_stations',
      block_mini_race: 'block_mini_race_stations',
      block_station_activation: 'block_station_activation_entries',
      block_station_block: 'block_station_block_entries',
    }

    const childCollection = stationChildMap[blockType]
    if (childCollection) {
      const stations = await client.request(
        withToken(getToken(), readItems(childCollection as any, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filter: { [`${blockType}_id`]: { _eq: blockId } } as any,
          fields: ['*', 'station_id.*'],
          sort: ['position'],
        }))
      )
      return { ...block, stations } as unknown as AnyBlock
    }

    return block as unknown as AnyBlock
  }

  async function updateBlock(blockType: BlockType, blockId: number, data: Partial<AnyBlock>) {
    return client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), updateItem(blockType as any, blockId, data as any))
    )
  }

  async function fetchStationCatalog() {
    return client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), readItems('station_catalog' as any, { fields: ['*'], limit: -1 }))
    )
  }

  async function fetchExerciseCatalog() {
    return client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), readItems('exercise_catalog' as any, { fields: ['*'], limit: -1 }))
    )
  }

  return {
    login,
    logout,
    getToken: fetchToken,
    fetchPlans,
    fetchPlan,
    fetchSession,
    fetchBlock,
    updateBlock,
    fetchStationCatalog,
    fetchExerciseCatalog,
  }
}
