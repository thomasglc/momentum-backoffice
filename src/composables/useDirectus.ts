import { createDirectus, rest, authentication, readItems, readItem, updateItem, withToken, createItem as sdkCreate, deleteItem as sdkDelete } from '@directus/sdk'
import type { Plan, AnyBlock, BlockType, Session, ResolvedBlock } from '@/types'

const BASE_URL = import.meta.env.DEV
  ? `${window.location.origin}/api`
  : (import.meta.env.VITE_DIRECTUS_URL || 'http://localhost:8056')

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

  async function deleteSession(sessionId: number) {
    const sbs = await client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), readItems('session_blocks' as any, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: { session_id: { _eq: sessionId } } as any,
        fields: ['id'],
      }))
    ) as { id: number }[]
    for (const sb of sbs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.request(withToken(getToken(), sdkDelete('session_blocks' as any, sb.id)))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.request(withToken(getToken(), sdkDelete('sessions' as any, sessionId)))
  }

  async function createCollectionItem(collection: string, data: Record<string, unknown>) {
    return client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), sdkCreate(collection as any, data as any))
    )
  }

  async function updateCollectionItem(collection: string, id: number, data: Record<string, unknown>) {
    return client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), updateItem(collection as any, id, data as any))
    )
  }

  async function deleteCollectionItem(collection: string, id: number) {
    return client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), sdkDelete(collection as any, id))
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

  async function copySession(
    session: Session,
    blocks: ResolvedBlock[],
    targetWeekId: number,
    targetDay: string
  ): Promise<void> {
    // 1. Créer la nouvelle session
    const newSession = await client.request(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withToken(getToken(), sdkCreate('sessions' as any, {
        week_id: targetWeekId,
        day: targetDay,
        type: session.type,
        title: session.title,
        description: session.description ?? null,
        duration_min: session.duration_min ?? null,
        intensity_score: session.intensity_score ?? null,
        focus: session.focus ?? null,
        coach_tip: session.coach_tip ?? null,
        optional: session.optional ?? false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any))
    ) as { id: number }

    // 2. Copier chaque bloc dans l'ordre
    for (const rb of blocks) {
      const { meta, data } = rb
      const blockType = meta.block_type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any

      if (blockType === 'block_cardio') {
        const nb = await client.request(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withToken(getToken(), sdkCreate('block_cardio' as any, {
            subtype: d.subtype, duration_min: d.duration_min,
            pace_zone: d.pace_zone, label: d.label, note: d.note,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any))
        ) as { id: number }
        await client.request(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withToken(getToken(), sdkCreate('session_blocks' as any, {
            session_id: newSession.id, block_type: 'block_cardio',
            block_id: nb.id, position: meta.position,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any))
        )
      } else if (blockType === 'block_intervals') {
        const nb = await client.request(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withToken(getToken(), sdkCreate('block_intervals' as any, {
            sets: d.sets, distance_km: d.distance_km, duration_min: d.duration_min,
            recovery_min: d.recovery_min, pace_zone: d.pace_zone, note: d.note,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any))
        ) as { id: number }
        await client.request(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withToken(getToken(), sdkCreate('session_blocks' as any, {
            session_id: newSession.id, block_type: 'block_intervals',
            block_id: nb.id, position: meta.position,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any))
        )
      } else if (blockType === 'block_strength') {
        const nb = await client.request(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withToken(getToken(), sdkCreate('block_strength' as any, {
            rest_sec: d.rest_sec, note: d.note,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any))
        ) as { id: number }
        for (const ex of (d.exercises ?? [])) {
          await client.request(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            withToken(getToken(), sdkCreate('block_strength_exercises' as any, {
              block_strength_id: nb.id,
              exercise_id: ex.exercise_id?.id ?? ex.exercise_id,
              position: ex.position, sets: ex.sets, reps: ex.reps,
              duration_sec: ex.duration_sec, weight_kg: ex.weight_kg,
              custom_label: ex.custom_label, note: ex.note,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any))
          )
        }
        await client.request(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withToken(getToken(), sdkCreate('session_blocks' as any, {
            session_id: newSession.id, block_type: 'block_strength',
            block_id: nb.id, position: meta.position,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any))
        )
      } else {
        // block_circuit, block_mini_race, block_station_activation, block_station_block
        const stationChildMap: Record<string, { collection: string; fk: string }> = {
          block_circuit:             { collection: 'block_circuit_stations',             fk: 'block_circuit_id' },
          block_mini_race:           { collection: 'block_mini_race_stations',            fk: 'block_mini_race_id' },
          block_station_activation:  { collection: 'block_station_activation_entries',    fk: 'block_station_activation_id' },
          block_station_block:       { collection: 'block_station_block_entries',         fk: 'block_station_block_id' },
        }
        const scalarMap: Record<string, Record<string, unknown>> = {
          block_circuit:            { format: d.format, label: d.label, rounds: d.rounds, duration_min: d.duration_min, rest_between_min: d.rest_between_min, note: d.note },
          block_mini_race:          { rounds: d.rounds, run_distance_km: d.run_distance_km, pace_zone: d.pace_zone, rest_between_rounds_min: d.rest_between_rounds_min, note: d.note },
          block_station_activation: { rounds: d.rounds, note: d.note },
          block_station_block:      { brick_format: d.brick_format, format_note: d.format_note },
        }
        const childInfo = stationChildMap[blockType]
        if (!childInfo) continue
        const nb = await client.request(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withToken(getToken(), sdkCreate(blockType as any, scalarMap[blockType] as any))
        ) as { id: number }
        for (const st of (d.stations ?? [])) {
          await client.request(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            withToken(getToken(), sdkCreate(childInfo.collection as any, {
              [childInfo.fk]: nb.id,
              station_id: st.station_id?.id ?? st.station_id,
              position: st.position, distance_m: st.distance_m, reps: st.reps,
              duration_sec: st.duration_sec, weight_kg_female: st.weight_kg_female,
              weight_kg_male: st.weight_kg_male, custom_label: st.custom_label, note: st.note,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any))
          )
        }
        await client.request(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withToken(getToken(), sdkCreate('session_blocks' as any, {
            session_id: newSession.id, block_type: blockType,
            block_id: nb.id, position: meta.position,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any))
        )
      }
    }
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
    deleteSession,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem,
    fetchStationCatalog,
    fetchExerciseCatalog,
    copySession,
  }
}
