import { createDirectus, rest, authentication, readItems, readItem, updateItem } from '@directus/sdk'
import type { Plan, AnyBlock, BlockType } from '@/types'

const BASE_URL = 'http://localhost:8056'

const client = createDirectus(BASE_URL)
  .with(authentication('json'))
  .with(rest())

export function useDirectus() {
  async function login(email: string, password: string) {
    return client.login({ email, password })
  }

  async function logout() {
    return client.logout()
  }

  async function getToken(): Promise<string | null> {
    return client.getToken()
  }

  async function fetchPlans(): Promise<Plan[]> {
    return client.request(
      readItems('plans' as any, { fields: ['*'] })
    ) as unknown as Promise<Plan[]>
  }

  async function fetchPlan(id: number): Promise<Plan> {
    return client.request(
      readItem('plans' as any, id, {
        fields: ['*', 'weeks.*', 'weeks.sessions.*'],
      })
    ) as unknown as Promise<Plan>
  }

  async function fetchSession(id: number) {
    return client.request(
      readItem('sessions' as any, id, {
        fields: ['*', 'blocks.*'],
      })
    )
  }

  async function fetchBlock(blockType: BlockType, blockId: number): Promise<AnyBlock> {
    const fieldsMap: Record<BlockType, string[]> = {
      block_cardio: ['*'],
      block_intervals: ['*'],
      block_strength: ['*', 'exercises.*', 'exercises.exercise_id.*'],
      block_circuit: ['*', 'stations.*', 'stations.station_id.*'],
      block_mini_race: ['*', 'stations.*', 'stations.station_id.*'],
      block_station_activation: ['*', 'stations.*', 'stations.station_id.*'],
      block_station_block: ['*', 'stations.*', 'stations.station_id.*'],
    }
    return client.request(
      readItem(blockType as any, blockId, { fields: fieldsMap[blockType] })
    ) as unknown as Promise<AnyBlock>
  }

  async function updateBlock(blockType: BlockType, blockId: number, data: Partial<AnyBlock>) {
    return client.request(updateItem(blockType as any, blockId, data as any))
  }

  async function fetchStationCatalog() {
    return client.request(readItems('station_catalog' as any, { fields: ['*'], limit: -1 }))
  }

  async function fetchExerciseCatalog() {
    return client.request(readItems('exercise_catalog' as any, { fields: ['*'], limit: -1 }))
  }

  return {
    login,
    logout,
    getToken,
    fetchPlans,
    fetchPlan,
    fetchSession,
    fetchBlock,
    updateBlock,
    fetchStationCatalog,
    fetchExerciseCatalog,
  }
}
