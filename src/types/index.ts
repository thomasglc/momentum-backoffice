export type SessionType = 'running' | 'hyrox' | 'brick' | 'strength' | 'mobility' | 'recovery' | 'race'
export type PaceZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | 'threshold' | 'race'
export type BlockType =
  | 'block_cardio'
  | 'block_intervals'
  | 'block_strength'
  | 'block_circuit'
  | 'block_mini_race'
  | 'block_station_activation'
  | 'block_station_block'

export type PlanType = 'open_solo' | 'open_double_mixte' | 'open_double_men' | 'open_double_women'

export interface Plan {
  id: number
  title: string
  description: string | null
  start_date: string | null
  sport: string
  level: string
  status: string
  plan_type: PlanType | null
  weeks: Week[]
}

export interface Week {
  id: number
  plan_id: number
  week_number: number
  phase: number
  theme: string | null
  is_deload: boolean
  week_note: string | null
  sessions: Session[]
}

export interface Session {
  id: number
  week_id: number
  day: string  // 'Lundi' | 'Mardi' | ... | 'Dimanche'
  type: SessionType
  optional: boolean | number
  title: string
  description: string | null
  duration_min: number | null
  intensity_score: number | null
  focus: string | null
  coach_tip: string | null
  slug: string | null
  blocks?: SessionBlock[]
}

export interface SessionBlock {
  id: number
  session_id: number
  position: number
  block_type: BlockType
  block_id: number
}

export interface BlockCardio {
  id: number
  subtype: 'warmup' | 'run' | 'cooldown' | 'brick_run' | 'target_pace'
  duration_min: number | null
  pace_zone: PaceZone | null
  label: string | null
  note: string | null
}

export interface BlockIntervals {
  id: number
  sets: number | null
  distance_km: number | null
  duration_min: number | null
  recovery_min: number | null
  pace_zone: PaceZone | null
  note: string | null
}

export interface ExerciseCatalog {
  id: number
  name: string
  category: string | null
  equipment: string | null
  notes: string | null
}

export interface BlockStrengthExercise {
  id: number
  block_strength_id: number
  exercise_id: ExerciseCatalog
  position: number
  sets: number | null
  reps: number | null
  duration_sec: number | null
  weight_kg: number | null
  custom_label: string | null
  note: string | null
}

export interface BlockStrength {
  id: number
  rest_sec: number | null
  note: string | null
  exercises: BlockStrengthExercise[]
}

export interface StationCatalog {
  id: number
  name: string
  measurement_type: string | null
  default_unit: string | null
  is_hyrox_official: boolean
  notes: string | null
}

export interface StationEntry {
  id: number
  position: number
  station_id: StationCatalog
  distance_m: number | null
  reps: number | null
  duration_sec: number | null
  weight_kg_female: number | null
  weight_kg_male: number | null
  custom_label: string | null
  note: string | null
}

export interface BlockCircuit {
  id: number
  format: 'rounds' | 'time' | 'amrap' | 'emom'
  label: string | null
  rounds: number | null
  duration_min: number | null
  rest_between_min: number | null
  note: string | null
  stations: StationEntry[]
}

export interface BlockMiniRace {
  id: number
  rounds: number | null
  run_distance_km: number | null
  pace_zone: PaceZone | null
  rest_between_rounds_min: number | null
  note: string | null
  stations: StationEntry[]
}

export interface BlockStationActivation {
  id: number
  rounds: number | null
  note: string | null
  stations: StationEntry[]
}

export interface BlockStationBlock {
  id: number
  brick_format: 'standard' | 'pyramid' | 'follow_the_leader'
  format_note: string | null
  stations: StationEntry[]
}

export type AnyBlock =
  | BlockCardio
  | BlockIntervals
  | BlockStrength
  | BlockCircuit
  | BlockMiniRace
  | BlockStationActivation
  | BlockStationBlock

export interface ResolvedBlock {
  meta: SessionBlock
  data: AnyBlock
}

// ── Directus user (compte auth)
export interface AthleteUser {
  id: string           // UUID Directus
  first_name: string | null
  last_name: string | null
  email: string
}

// ── Profil athlète (athlete_profiles)
export interface AthleteProfile {
  id: number
  directus_user_id: string    // UUID → directus_users.id
  plan_id: number | { id: number; title: string; status: string }
  name: string | null         // legacy : stocké comme UUID dans le mobile
  gender: 'homme' | 'femme' | null
  ten_km_time_sec: number | null
  race_date: string | null    // ISO date 'YYYY-MM-DD'
  created_at: string | null
  updated_at: string | null
}

// ── Vue unifiée utilisée dans le back office
export interface AthleteView {
  user: AthleteUser
  profile: AthleteProfile | null
}
