# Athletes Refactor — athlete_profiles + directus_users

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Remplacer les tables `athletes` / `athlete_plan_assignments` par `athlete_profiles` + `directus_users` (Directus native auth), créer un rôle "Athlète" avec permissions restrictives, et unifier les deux apps sur le même schéma.

**Architecture:**
- Les athlètes sont des comptes Directus avec le rôle "Athlète"
- `athlete_profiles` stocke le profil métier (genre, temps 10km, plan, race_date)
- Le back office crée les comptes Directus et les profils ; l'app mobile les utilise pour s'authentifier
- Les tables `athletes` et `athlete_plan_assignments` sont supprimées

**Tech Stack:** PostgreSQL 16, Directus SDK v21, Vue 3 + TypeScript, Pinia

---

## Task 1: Migration DB

**Files:**
- Create: `C:\Users\thoma\Documents\Claude\momentum-directus\database\migrate_athletes_refactor.sql`

- [ ] Créer le fichier SQL :

```sql
-- Migration: athletes refactor — 2026-06-09
-- Ajouter race_date à athlete_profiles
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS race_date DATE;

-- Supprimer les nouvelles tables (remplacées par athlete_profiles)
DROP TABLE IF EXISTS athlete_plan_assignments CASCADE;
DROP TABLE IF EXISTS athletes CASCADE;
```

- [ ] Appliquer la migration :

```powershell
cd "C:\Users\thoma\Documents\Claude\momentum-directus"
docker compose -f docker-compose.local.yml cp database\migrate_athletes_refactor.sql postgres:/tmp/migrate_athletes_refactor.sql
docker compose -f docker-compose.local.yml exec postgres psql -U directus -d directus -f /tmp/migrate_athletes_refactor.sql
```

Expected:
```
ALTER TABLE
DROP TABLE
DROP TABLE
```

- [ ] Vérifier :

```bash
cd "C:\Users\thoma\Documents\Claude\momentum-directus"
docker compose -f docker-compose.local.yml exec postgres psql -U directus -d directus -c "\d athlete_profiles"
```

Expected: colonne `race_date` présente, tables `athletes` et `athlete_plan_assignments` supprimées.

- [ ] Commit depuis momentum-directus :

```bash
git -C "C:\Users\thoma\Documents\Claude\momentum-directus" add database/migrate_athletes_refactor.sql
git -C "C:\Users\thoma\Documents\Claude\momentum-directus" commit -m "feat: add race_date to athlete_profiles, drop athletes tables"
```

---

## Task 2: Rôle Directus "Athlète" + permissions

Créer le rôle "Athlète" dans Directus avec des permissions restrictives (accès mobile uniquement).

- [ ] Obtenir un token admin et créer le rôle :

```bash
TOKEN=$(curl -s -X POST http://localhost:8056/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"thomas.galocha@hotmail.fr","password":"thomas67"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Créer le rôle Athlète
ROLE_ID=$(curl -s -X POST "http://localhost:8056/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Athlète","icon":"directions_run","description":"Accès app mobile Momentum uniquement"}' \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "Role ID: $ROLE_ID"
```

- [ ] Ajouter les permissions pour `athlete_profiles` (read/update own) :

```bash
# READ athlete_profiles (own only)
curl -s -X POST "http://localhost:8056/permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"$ROLE_ID\",\"collection\":\"athlete_profiles\",\"action\":\"read\",\"fields\":[\"*\"],\"permissions\":{\"directus_user_id\":{\"_eq\":\"\$CURRENT_USER\"}}}"

# UPDATE athlete_profiles (own only)
curl -s -X POST "http://localhost:8056/permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"$ROLE_ID\",\"collection\":\"athlete_profiles\",\"action\":\"update\",\"fields\":[\"gender\",\"ten_km_time_sec\"],\"permissions\":{\"directus_user_id\":{\"_eq\":\"\$CURRENT_USER\"}}}"

# CREATE athlete_profiles (pour saveProfile du mobile)
curl -s -X POST "http://localhost:8056/permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"$ROLE_ID\",\"collection\":\"athlete_profiles\",\"action\":\"create\",\"fields\":[\"*\"]}"
```

- [ ] Ajouter permissions lecture pour les collections plan (read-only, sans filtre) :

```bash
for COLLECTION in plans weeks sessions session_blocks block_cardio block_intervals block_strength block_strength_exercises block_circuit block_circuit_stations block_mini_race block_mini_race_stations block_station_activation block_station_activation_entries block_station_block block_station_block_entries station_catalog exercise_catalog; do
  curl -s -X POST "http://localhost:8056/permissions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"role\":\"$ROLE_ID\",\"collection\":\"$COLLECTION\",\"action\":\"read\",\"fields\":[\"*\"]}" > /dev/null
  echo "Permission read added: $COLLECTION"
done
```

- [ ] Sauvegarder le ROLE_ID pour les tâches suivantes :

```bash
echo $ROLE_ID > /tmp/athlete_role_id.txt
cat /tmp/athlete_role_id.txt
```

- [ ] Vérifier que les permissions existent :

```bash
curl -s "http://localhost:8056/permissions?filter[role][_eq]=$ROLE_ID&limit=50" \
  -H "Authorization: Bearer $TOKEN" | grep -o '"collection":"[^"]*"'
```

---

## Task 3: Types TypeScript

**Files:**
- Modify: `src/types/index.ts`

Remplacer les types `Athlete`, `AthleteAssignment`, `AthleteWithAssignment` par les nouveaux types basés sur `athlete_profiles` + `directus_users`.

- [ ] Lire `src/types/index.ts` puis remplacer les 3 interfaces athletes (de la ligne `export interface Athlete` jusqu'à la fin du fichier) par :

```typescript
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
```

- [ ] Vérifier : `npm run type-check`

- [ ] Commit :

```bash
git add src/types/index.ts
git commit -m "refactor: replace Athlete types with AthleteProfile + AthleteUser"
```

---

## Task 4: Réécriture du store `athletes`

**Files:**
- Rewrite: `src/stores/athletes.ts`

Le store relit maintenant depuis `directus_users` (filtrés par rôle "Athlète") + `athlete_profiles`.

- [ ] Remplacer `src/stores/athletes.ts` par :

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDirectus, rest, authentication, readItems, createItem, updateItem, deleteItem, readUsers, createUser, updateUser, deleteUser, readRoles } from '@directus/sdk'
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

let _athleteRoleId: string | null = null

async function getAthleteRoleId(): Promise<string | null> {
  if (_athleteRoleId) return _athleteRoleId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roles = await client.request(readRoles({ filter: { name: { _eq: 'Athlète' } } as any }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _athleteRoleId = (roles as any[])[0]?.id ?? null
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

      // Charger les users avec le rôle Athlète
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users = await client.request(readUsers({
        filter: { role: { _eq: roleId } } as any,
        fields: ['id', 'first_name', 'last_name', 'email'],
        sort: ['first_name', 'last_name'],
        limit: -1,
      })) as AthleteUser[]

      // Charger tous les profiles
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

    // 1. Créer le compte Directus
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newUser = await client.request(createUser({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      password: data.password,
      role: roleId,
    } as any)) as { id: string }

    // 2. Créer le profil athlète
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.request(createItem('athlete_profiles' as any, {
      directus_user_id: newUser.id,
      name: newUser.id,   // compatibilité mobile
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

    // Mise à jour compte Directus
    const userPatch: Record<string, unknown> = {}
    if (data.firstName !== undefined) userPatch.first_name = data.firstName
    if (data.lastName !== undefined) userPatch.last_name = data.lastName
    if (data.email !== undefined) userPatch.email = data.email
    if (data.password) userPatch.password = data.password

    if (Object.keys(userPatch).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.request(updateUser(userId, userPatch as any))
    }

    // Mise à jour profil
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
```

- [ ] `npm run type-check`

- [ ] Commit :

```bash
git add src/stores/athletes.ts
git commit -m "refactor: rewrite athletes store to use athlete_profiles + directus_users"
```

---

## Task 5: Réécriture du composant `AthleteDrawer`

**Files:**
- Rewrite: `src/components/athletes/AthleteDrawer.vue`

Nouveaux champs : `first_name`, `last_name`, `email`, `password` (obligatoire à la création), `gender`, `ten_km_time_sec`, `plan_id`, `race_date`.

- [ ] Remplacer `src/components/athletes/AthleteDrawer.vue` par :

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAthleteStore } from '@/stores/athletes'
import { usePlanStore } from '@/stores/plan'
import { useAthleteSchedule } from '@/composables/useAthleteSchedule'
import type { AthleteView } from '@/types'

const props = defineProps<{
  open: boolean
  athlete: AthleteView | null
}>()

const emit = defineEmits<{ close: [] }>()

const athleteStore = useAthleteStore()
const planStore = usePlanStore()
const { scheduleInfo } = useAthleteSchedule()

const saving = ref(false)
const errorMsg = ref<string | null>(null)

const firstName = ref('')
const lastName  = ref('')
const email     = ref('')
const password  = ref('')
const gender    = ref<'homme' | 'femme' | ''>('')
const tenKmMin  = ref('')
const tenKmSec  = ref('')
const planId    = ref<number | null>(null)
const raceDate  = ref('')

const isEdit = computed(() => !!props.athlete)

const availablePlans = computed(() =>
  (planStore.plans ?? []).filter(p => p.status === 'active' || p.status === 'draft')
)

const info = computed(() => {
  if (!raceDate.value) return null
  return scheduleInfo(raceDate.value)
})

const canSave = computed(() => {
  if (!firstName.value.trim() || !email.value.trim()) return false
  if (!isEdit.value && !password.value.trim()) return false
  if (!planId.value) return false
  if (raceDate.value && !(info.value?.valid ?? false)) return false
  return true
})

watch(() => props.athlete, (a) => {
  if (a) {
    firstName.value  = a.user.first_name ?? ''
    lastName.value   = a.user.last_name ?? ''
    email.value      = a.user.email
    password.value   = ''
    gender.value     = (a.profile?.gender as 'homme' | 'femme') ?? ''
    raceDate.value   = a.profile?.race_date ?? ''
    const pid = a.profile?.plan_id
    planId.value     = typeof pid === 'object' ? pid.id : (pid ?? null)
    const secs = a.profile?.ten_km_time_sec
    if (secs) {
      tenKmMin.value = String(Math.floor(secs / 60))
      tenKmSec.value = String(secs % 60).padStart(2, '0')
    } else {
      tenKmMin.value = ''
      tenKmSec.value = ''
    }
  } else {
    firstName.value = ''
    lastName.value  = ''
    email.value     = ''
    password.value  = ''
    gender.value    = ''
    tenKmMin.value  = ''
    tenKmSec.value  = ''
    planId.value    = null
    raceDate.value  = ''
  }
}, { immediate: true })

function parseTenKm(): number | null {
  const m = parseInt(tenKmMin.value)
  const s = parseInt(tenKmSec.value)
  if (isNaN(m) && isNaN(s)) return null
  return (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s)
}

async function save() {
  if (!canSave.value || !planId.value) return
  saving.value = true
  errorMsg.value = null
  try {
    if (props.athlete) {
      await athleteStore.updateAthlete(props.athlete, {
        firstName:   firstName.value.trim(),
        lastName:    lastName.value.trim(),
        email:       email.value.trim(),
        password:    password.value || undefined,
        gender:      (gender.value as 'homme' | 'femme') || null,
        tenKmTimeSec: parseTenKm(),
        planId:      planId.value,
        raceDate:    raceDate.value || null,
      })
    } else {
      await athleteStore.createAthlete({
        firstName:   firstName.value.trim(),
        lastName:    lastName.value.trim(),
        email:       email.value.trim(),
        password:    password.value.trim(),
        gender:      (gender.value as 'homme' | 'femme') || null,
        tenKmTimeSec: parseTenKm(),
        planId:      planId.value,
        raceDate:    raceDate.value || null,
      })
    }
    emit('close')
  } catch (e: unknown) {
    errorMsg.value = (e as any)?.message ?? 'Erreur lors de la sauvegarde'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 bg-black/20 z-40" @click="emit('close')" />
  </Transition>

  <Transition name="slide">
    <aside v-if="open"
      class="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
        <h2 class="text-sm font-semibold text-slate-900">
          {{ isEdit ? "Modifier l'athlète" : 'Ajouter un athlète' }}
        </h2>
        <button @click="emit('close')" class="p-1 rounded hover:bg-slate-100 transition-colors">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-5 py-5 space-y-6">

        <!-- Identité -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Identité</h3>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Prénom *</label>
              <input v-model="firstName" type="text" placeholder="Marie"
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nom</label>
              <input v-model="lastName" type="text" placeholder="Dupont"
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Email *</label>
            <input v-model="email" type="email" placeholder="marie@example.com"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Mot de passe {{ isEdit ? '(laisser vide pour ne pas changer)' : '*' }}
            </label>
            <input v-model="password" type="password" placeholder="••••••••"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Genre</label>
            <select v-model="gender"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
              <option value="">Non renseigné</option>
              <option value="homme">Homme</option>
              <option value="femme">Femme</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Temps 10 km</label>
            <div class="flex items-center gap-2">
              <input v-model="tenKmMin" type="number" min="0" max="99" placeholder="45"
                class="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
              <span class="text-sm text-slate-400">min</span>
              <input v-model="tenKmSec" type="number" min="0" max="59" placeholder="00"
                class="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
              <span class="text-sm text-slate-400">sec</span>
            </div>
          </div>
        </div>

        <!-- Plan & Course -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan & Course</h3>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Plan *</label>
            <select v-model="planId"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
              <option :value="null" disabled>Sélectionner un plan...</option>
              <option v-for="plan in availablePlans" :key="plan.id" :value="plan.id">
                {{ plan.title }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Date de course</label>
            <input v-model="raceDate" type="date"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
          </div>

          <div v-if="info" class="px-3 py-2 rounded-lg text-xs"
            :class="info.valid ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'">
            {{ info.message }}
          </div>
        </div>

        <div v-if="errorMsg" class="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {{ errorMsg }}
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
        <button @click="emit('close')"
          class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
          Annuler
        </button>
        <button @click="save" :disabled="!canSave || saving"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          :class="canSave && !saving ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'">
          {{ saving ? 'Sauvegarde...' : (isEdit ? 'Enregistrer' : 'Ajouter') }}
        </button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform 0.25s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
```

- [ ] `npm run type-check`

- [ ] Commit :

```bash
git add src/components/athletes/AthleteDrawer.vue
git commit -m "refactor: rewrite AthleteDrawer for athlete_profiles + directus_users"
```

---

## Task 6: Mise à jour `AthleteTable` + `AthleteWeekBadge` + `AthletesView`

**Files:**
- Rewrite: `src/components/athletes/AthleteTable.vue`
- Modify: `src/views/AthletesView.vue`

`AthleteTable` passe de `AthleteWithAssignment[]` à `AthleteView[]`. `AthletesView` adapte les appels.

- [ ] Remplacer `src/components/athletes/AthleteTable.vue` par :

```vue
<script setup lang="ts">
import AthleteWeekBadge from './AthleteWeekBadge.vue'
import type { AthleteView } from '@/types'

defineProps<{ athletes: AthleteView[] }>()
const emit = defineEmits<{
  edit: [athlete: AthleteView]
  delete: [athlete: AthleteView]
}>()

function fullName(a: AthleteView): string {
  const parts = [a.user.first_name, a.user.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : a.user.email
}

function formatRaceDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date))
}

function planTitle(a: AthleteView): string {
  const pid = a.profile?.plan_id
  if (!pid) return '—'
  return typeof pid === 'object' ? pid.title : `Plan #${pid}`
}

function planId(a: AthleteView): number | null {
  const pid = a.profile?.plan_id
  if (!pid) return null
  return typeof pid === 'object' ? pid.id : pid
}

function genderLabel(g: string | null): string {
  if (g === 'homme') return 'H'
  if (g === 'femme') return 'F'
  return ''
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200">
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Athlète</th>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date de course</th>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avancement</th>
          <th class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="athlete in athletes" :key="athlete.user.id"
          class="hover:bg-slate-50 transition-colors group">

          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="font-medium text-slate-900">{{ fullName(athlete) }}</span>
              <span v-if="athlete.profile?.gender"
                class="text-xs px-1.5 py-0.5 rounded font-medium"
                :class="athlete.profile.gender === 'homme' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'">
                {{ genderLabel(athlete.profile.gender) }}
              </span>
            </div>
            <div class="text-xs text-slate-400">{{ athlete.user.email }}</div>
          </td>

          <td class="px-4 py-3">
            <RouterLink v-if="planId(athlete)" :to="`/plans/${planId(athlete)}`"
              class="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">
              {{ planTitle(athlete) }}
            </RouterLink>
            <span v-else class="text-slate-400">—</span>
          </td>

          <td class="px-4 py-3 text-slate-600">
            <span v-if="athlete.profile?.race_date">
              {{ formatRaceDate(athlete.profile.race_date) }}
            </span>
            <span v-else class="text-slate-400 italic text-xs">À définir</span>
          </td>

          <td class="px-4 py-3">
            <AthleteWeekBadge v-if="athlete.profile?.race_date" :race-date="athlete.profile.race_date"/>
            <span v-else class="text-slate-400">—</span>
          </td>

          <td class="px-4 py-3">
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="emit('edit', athlete)"
                class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Modifier">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button @click="emit('delete', athlete)"
                class="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Supprimer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>

        <tr v-if="athletes.length === 0">
          <td colspan="5" class="px-4 py-12 text-center text-sm text-slate-400">
            Aucun athlète — cliquez sur "Ajouter un athlète" pour commencer.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] Mettre à jour `src/views/AthletesView.vue` — changer le type et l'appel delete :

Dans le `<script setup>`, remplacer `AthleteWithAssignment` par `AthleteView` partout, et dans `doDelete` passer l'objet complet plutôt que l'id :

```typescript
// Remplacer
import type { AthleteWithAssignment } from '@/types'
const editingAthlete = ref<AthleteWithAssignment | null>(null)
const deletingAthlete = ref<AthleteWithAssignment | null>(null)
function openEdit(athlete: AthleteWithAssignment) { ... }
async function confirmDelete(athlete: AthleteWithAssignment) { ... }
// await athleteStore.deleteAthlete(deletingAthlete.value.id)

// Par
import type { AthleteView } from '@/types'
const editingAthlete = ref<AthleteView | null>(null)
const deletingAthlete = ref<AthleteView | null>(null)
function openEdit(athlete: AthleteView) { ... }
async function confirmDelete(athlete: AthleteView) { ... }
// await athleteStore.deleteAthlete(deletingAthlete.value)
```

Dans le template, remplacer `deletingAthlete.name` par le nom complet :
```html
<!-- Remplacer {{ deletingAthlete.name }} par -->
{{ [deletingAthlete.user.first_name, deletingAthlete.user.last_name].filter(Boolean).join(' ') || deletingAthlete.user.email }}
```

- [ ] `npm run type-check && npm run lint`

- [ ] Commit :

```bash
git add src/components/athletes/AthleteTable.vue src/views/AthletesView.vue
git commit -m "refactor: update AthleteTable and AthletesView for AthleteView type"
```

---

## Task 7: Nettoyage collections Directus

Supprimer les collections `athletes` et `athlete_plan_assignments` de l'admin Directus (les tables SQL ont déjà été supprimées).

- [ ] Supprimer les collections via l'API :

```bash
TOKEN=$(curl -s -X POST http://localhost:8056/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"thomas.galocha@hotmail.fr","password":"thomas67"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -s -X DELETE "http://localhost:8056/collections/athlete_plan_assignments" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X DELETE "http://localhost:8056/collections/athletes" \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] Vérifier le type-check final :

```bash
npm run type-check && npm run lint
```

- [ ] Commit final :

```bash
git add -A
git commit -m "refactor: athletes management now uses athlete_profiles + directus_users"
```
