# Athletes Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une section `/athletes` au back office pour gérer les athlètes, leur assigner un plan Hyrox avec une date de course, et calculer automatiquement l'avancement dans le plan.

**Architecture:** Deux nouvelles tables PostgreSQL (`athletes` + `athlete_plan_assignments`) exposées via l'API Directus. La logique de calcul de semaines est un composable Vue pur. L'UI est une vue liste + side drawer, cohérente avec le reste de l'app.

**Tech Stack:** Vue 3 + `<script setup>` + TypeScript, Pinia, Directus SDK v21, Tailwind v4, PostgreSQL 16

---

## Task 1: Migration base de données

**Files:**
- Create: `C:\Users\thoma\Documents\Claude\momentum-directus\database\migrate_athletes.sql`

- [ ] **Step 1: Créer le fichier de migration SQL**

Créer `C:\Users\thoma\Documents\Claude\momentum-directus\database\migrate_athletes.sql` :

```sql
-- Migration: athletes + athlete_plan_assignments
-- 2026-06-08

CREATE TABLE IF NOT EXISTS athletes (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  ten_km_time_sec INTEGER,
  notes           TEXT,
  date_created    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS athlete_plan_assignments (
  id          SERIAL PRIMARY KEY,
  athlete_id  INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  plan_id     INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  race_date   DATE NOT NULL,
  notes       TEXT,
  date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> Note: Directus utilise `date_created` / `date_updated` comme noms de colonnes standards. On suit cette convention.

- [ ] **Step 2: Appliquer la migration sur le PostgreSQL local**

```powershell
cd "C:\Users\thoma\Documents\Claude\momentum-directus"
docker compose -f docker-compose.local.yml exec postgres psql -U directus -d directus -f /dev/stdin < database\migrate_athletes.sql
```

Si le fichier n'est pas accessible via stdin, utiliser :
```powershell
docker compose -f docker-compose.local.yml cp database\migrate_athletes.sql postgres:/tmp/migrate_athletes.sql
docker compose -f docker-compose.local.yml exec postgres psql -U directus -d directus -f /tmp/migrate_athletes.sql
```

Expected output:
```
CREATE TABLE
CREATE TABLE
```

- [ ] **Step 3: Vérifier les tables créées**

```powershell
docker compose -f docker-compose.local.yml exec postgres psql -U directus -d directus -c "\dt athletes" -c "\dt athlete_plan_assignments"
```

Expected: les deux tables listées.

- [ ] **Step 4: Enregistrer les collections dans Directus via l'API**

Directus doit connaître ces tables pour exposer `/items/athletes`. Utiliser curl (ou Invoke-WebRequest) pour enregistrer les collections. D'abord obtenir le token admin :

```powershell
$resp = Invoke-WebRequest -Uri "http://localhost:8056/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"thomas.galocha@hotmail.fr","password":"thomas67"}'
$token = ($resp.Content | ConvertFrom-Json).data.access_token
```

Enregistrer `athletes` :
```powershell
Invoke-WebRequest -Uri "http://localhost:8056/collections" -Method POST `
  -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} `
  -Body '{"collection":"athletes","meta":{"icon":"people","color":"#6366F1"},"schema":{},"fields":[]}'
```

Enregistrer `athlete_plan_assignments` :
```powershell
Invoke-WebRequest -Uri "http://localhost:8056/collections" -Method POST `
  -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} `
  -Body '{"collection":"athlete_plan_assignments","meta":{"icon":"link","color":"#8B5CF6"},"schema":{},"fields":[]}'
```

Expected: réponse 200 avec les métadonnées de collection.

- [ ] **Step 5: Vérifier que l'API répond**

```powershell
Invoke-WebRequest -Uri "http://localhost:8056/items/athletes" -Headers @{"Authorization"="Bearer $token"} | Select-Object StatusCode
```

Expected: `StatusCode : 200`

- [ ] **Step 6: Commit**

```bash
git add C:\Users\thoma\Documents\Claude\momentum-directus\database\migrate_athletes.sql
git commit -m "feat: add athletes and athlete_plan_assignments tables"
```

---

## Task 2: Types TypeScript

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Ajouter les types à la fin de `src/types/index.ts`**

```typescript
export interface Athlete {
  id: number
  name: string
  email: string | null
  ten_km_time_sec: number | null
  notes: string | null
  date_created: string | null
  date_updated: string | null
  assignments?: AthleteAssignment[]
}

export interface AthleteAssignment {
  id: number
  athlete_id: number
  plan_id: number | { id: number; title: string; status: string }
  race_date: string  // ISO date 'YYYY-MM-DD'
  notes: string | null
  date_created: string | null
  date_updated: string | null
}

// Forme enrichie utilisée dans l'UI (assignment avec plan résolu)
export interface AthleteWithAssignment extends Athlete {
  assignment: (AthleteAssignment & { plan_id: { id: number; title: string; status: string } }) | null
}
```

- [ ] **Step 2: Vérifier la compilation**

```bash
npm run type-check
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Athlete and AthleteAssignment types"
```

---

## Task 3: Composable `useAthleteSchedule`

**Files:**
- Create: `src/composables/useAthleteSchedule.ts`

Ce composable est **pur** : aucune requête HTTP, seulement des calculs de dates. Un plan Hyrox fait 19 semaines. La semaine 19 = la semaine contenant `race_date`. La semaine N commence `(19 - N) * 7` jours avant `race_date`.

- [ ] **Step 1: Créer `src/composables/useAthleteSchedule.ts`**

```typescript
const PLAN_WEEKS = 19
const MIN_WEEKS = 12
const MS_PER_DAY = 86_400_000
const MS_PER_WEEK = 7 * MS_PER_DAY

// Lundi de la semaine contenant une date donnée
function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=dim, 1=lun, ...
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function useAthleteSchedule() {
  // Date de début de la semaine N du plan (1-indexed)
  function weekStartDate(raceDate: string, weekNumber: number): Date {
    const race = weekStart(new Date(raceDate))
    const offsetWeeks = PLAN_WEEKS - weekNumber
    return new Date(race.getTime() - offsetWeeks * MS_PER_WEEK)
  }

  // Numéro de semaine du plan (1-19) pour une date donnée. Peut être < 1 ou > 19.
  function weekForDate(raceDate: string, date: Date = new Date()): number {
    const race = weekStart(new Date(raceDate))
    const target = weekStart(date)
    const diffWeeks = Math.round((race.getTime() - target.getTime()) / MS_PER_WEEK)
    return PLAN_WEEKS - diffWeeks
  }

  // Semaine courante de l'athlète (aujourd'hui)
  function currentWeek(raceDate: string): number {
    return weekForDate(raceDate, new Date())
  }

  // Date de début du plan (semaine 1, lundi)
  function planStartDate(raceDate: string): Date {
    return weekStartDate(raceDate, 1)
  }

  // Nombre de semaines non couvertes si l'athlète commence aujourd'hui
  function weeksSkipped(raceDate: string): number {
    const cw = currentWeek(raceDate)
    if (cw <= 1) return 0
    return Math.max(0, cw - 1)
  }

  // Nombre de semaines restantes (depuis aujourd'hui jusqu'à la fin)
  function weeksRemaining(raceDate: string): number {
    const cw = currentWeek(raceDate)
    return Math.max(0, PLAN_WEEKS - cw + 1)
  }

  // Jours restants avant la date de course
  function daysUntilRace(raceDate: string): number {
    const race = new Date(raceDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.ceil((race.getTime() - today.getTime()) / MS_PER_DAY)
  }

  // false si moins de MIN_WEEKS semaines restantes
  function isValid(raceDate: string): boolean {
    return weeksRemaining(raceDate) >= MIN_WEEKS
  }

  // Message d'info pour l'UI du drawer
  function scheduleInfo(raceDate: string): { message: string; valid: boolean } {
    const remaining = weeksRemaining(raceDate)
    const skipped = weeksSkipped(raceDate)
    const startWeek = currentWeek(raceDate)

    if (!isValid(raceDate)) {
      return {
        message: `⚠ Seulement ${remaining} semaine${remaining > 1 ? 's' : ''} — minimum ${MIN_WEEKS} requises`,
        valid: false,
      }
    }
    if (skipped === 0) {
      return { message: 'Plan complet — 19 semaines couvertes.', valid: true }
    }
    return {
      message: `Plan démarrera à la semaine ${startWeek} (J-${daysUntilRace(raceDate)}). Semaines 1 à ${skipped} non couvertes.`,
      valid: true,
    }
  }

  return {
    weekStartDate,
    weekForDate,
    currentWeek,
    planStartDate,
    weeksSkipped,
    weeksRemaining,
    daysUntilRace,
    isValid,
    scheduleInfo,
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

```bash
npm run type-check
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useAthleteSchedule.ts
git commit -m "feat: add useAthleteSchedule composable"
```

---

## Task 4: Store Pinia `athletes`

**Files:**
- Create: `src/stores/athletes.ts`

- [ ] **Step 1: Créer `src/stores/athletes.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readItems, readItem, createItem, updateItem, deleteItem } from '@directus/sdk'
import type { Athlete, AthleteAssignment, AthleteWithAssignment } from '@/types'

// Accès direct au client Directus (même pattern que useDirectus.ts)
import { createDirectus, rest, authentication } from '@directus/sdk'
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

export const useAthleteStore = defineStore('athletes', () => {
  const athletes = ref<AthleteWithAssignment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAthletes() {
    loading.value = true
    error.value = null
    try {
      // Charger tous les athlètes
      const raw = await client.request(
        readItems('athletes' as any, { fields: ['*'], sort: ['name'], limit: -1 })
      ) as Athlete[]

      // Charger tous les assignments avec le plan résolu
      const assignments = await client.request(
        readItems('athlete_plan_assignments' as any, {
          fields: ['*', 'plan_id.id', 'plan_id.title', 'plan_id.status'],
          limit: -1,
        })
      ) as AthleteAssignment[]

      // Joindre
      athletes.value = raw.map(a => ({
        ...a,
        assignment: (assignments.find(asg => asg.athlete_id === a.id) ?? null) as AthleteWithAssignment['assignment'],
      }))
    } catch (e: any) {
      error.value = e?.message ?? 'Erreur lors du chargement des athlètes'
    } finally {
      loading.value = false
    }
  }

  async function createAthlete(data: {
    name: string
    email?: string | null
    ten_km_time_sec?: number | null
    notes?: string | null
    planId: number
    raceDate: string
    assignmentNotes?: string | null
  }) {
    const { planId, raceDate, assignmentNotes, ...athleteData } = data
    const newAthlete = await client.request(
      createItem('athletes' as any, athleteData as any)
    ) as Athlete

    await client.request(
      createItem('athlete_plan_assignments' as any, {
        athlete_id: newAthlete.id,
        plan_id: planId,
        race_date: raceDate,
        notes: assignmentNotes ?? null,
      } as any)
    )

    await fetchAthletes()
  }

  async function updateAthlete(id: number, data: {
    name?: string
    email?: string | null
    ten_km_time_sec?: number | null
    notes?: string | null
    planId?: number
    raceDate?: string
    assignmentNotes?: string | null
  }, assignmentId: number | null) {
    const { planId, raceDate, assignmentNotes, ...athleteData } = data

    if (Object.keys(athleteData).length > 0) {
      await client.request(updateItem('athletes' as any, id, athleteData as any))
    }

    if (assignmentId && (planId !== undefined || raceDate !== undefined)) {
      await client.request(updateItem('athlete_plan_assignments' as any, assignmentId, {
        ...(planId !== undefined ? { plan_id: planId } : {}),
        ...(raceDate !== undefined ? { race_date: raceDate } : {}),
        ...(assignmentNotes !== undefined ? { notes: assignmentNotes } : {}),
      } as any))
    } else if (!assignmentId && planId && raceDate) {
      await client.request(createItem('athlete_plan_assignments' as any, {
        athlete_id: id,
        plan_id: planId,
        race_date: raceDate,
        notes: assignmentNotes ?? null,
      } as any))
    }

    await fetchAthletes()
  }

  async function deleteAthlete(id: number) {
    await client.request(deleteItem('athletes' as any, id))
    athletes.value = athletes.value.filter(a => a.id !== id)
  }

  return { athletes, loading, error, fetchAthletes, createAthlete, updateAthlete, deleteAthlete }
})
```

- [ ] **Step 2: Vérifier la compilation**

```bash
npm run type-check
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/stores/athletes.ts
git commit -m "feat: add athletes Pinia store"
```

---

## Task 5: Router + Sidebar

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/components/layout/AppSidebar.vue`

- [ ] **Step 1: Ajouter la route dans `src/router/index.ts`**

Après la route `/plans` (ligne ~21), ajouter :

```typescript
    {
      path: '/athletes',
      name: 'athletes',
      component: () => import('@/views/AthletesView.vue'),
    },
```

- [ ] **Step 2: Ajouter l'entrée "Athlètes" dans `src/components/layout/AppSidebar.vue`**

Dans le bloc `<nav v-if="!isInPlan">` (ligne ~53), après le RouterLink vers `/plans`, ajouter :

```html
      <RouterLink
        to="/athletes"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        active-class="bg-indigo-50 text-indigo-700"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Athlètes
      </RouterLink>
```

- [ ] **Step 3: Vérifier la compilation**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts src/components/layout/AppSidebar.vue
git commit -m "feat: add athletes route and sidebar entry"
```

---

## Task 6: Composant `AthleteWeekBadge`

**Files:**
- Create: `src/components/athletes/AthleteWeekBadge.vue`

- [ ] **Step 1: Créer `src/components/athletes/AthleteWeekBadge.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useAthleteSchedule } from '@/composables/useAthleteSchedule'

const props = defineProps<{ raceDate: string }>()

const { currentWeek, weeksRemaining, daysUntilRace, isValid } = useAthleteSchedule()

const week = computed(() => currentWeek(props.raceDate))
const remaining = computed(() => weeksRemaining(props.raceDate))
const days = computed(() => daysUntilRace(props.raceDate))
const valid = computed(() => isValid(props.raceDate))

const status = computed(() => {
  if (week.value < 1) return 'not-started'
  if (week.value > 19) return 'done'
  return 'active'
})
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Semaine courante -->
    <span
      v-if="status === 'active'"
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      :class="valid ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'"
    >
      S{{ week }} / 19
    </span>
    <span
      v-else-if="status === 'not-started'"
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500"
    >
      Pas encore démarré
    </span>
    <span
      v-else
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700"
    >
      Terminé
    </span>

    <!-- Jours restants -->
    <span v-if="days > 0" class="text-xs text-slate-400">{{ days }}j</span>

    <!-- Alerte minimum -->
    <span
      v-if="!valid && status === 'active'"
      class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600"
      title="Moins de 12 semaines — préparation insuffisante"
    >
      ⚠ &lt;12 sem.
    </span>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/athletes/AthleteWeekBadge.vue
git commit -m "feat: add AthleteWeekBadge component"
```

---

## Task 7: Composant `AthleteDrawer`

**Files:**
- Create: `src/components/athletes/AthleteDrawer.vue`

- [ ] **Step 1: Créer `src/components/athletes/AthleteDrawer.vue`**

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAthleteStore } from '@/stores/athletes'
import { usePlanStore } from '@/stores/plan'
import { useAthleteSchedule } from '@/composables/useAthleteSchedule'
import type { AthleteWithAssignment } from '@/types'

const props = defineProps<{
  open: boolean
  athlete: AthleteWithAssignment | null
}>()

const emit = defineEmits<{ close: [] }>()

const athleteStore = useAthleteStore()
const planStore = usePlanStore()
const { scheduleInfo } = useAthleteSchedule()

const saving = ref(false)
const errorMsg = ref<string | null>(null)

// Form state
const name = ref('')
const email = ref('')
const tenKmMin = ref('')
const tenKmSec = ref('')
const notes = ref('')
const planId = ref<number | null>(null)
const raceDate = ref('')
const assignmentNotes = ref('')

// Plans disponibles (actifs + brouillons)
const availablePlans = computed(() =>
  (planStore.plans ?? []).filter(p => p.status === 'active' || p.status === 'draft')
)

const info = computed(() => {
  if (!raceDate.value) return null
  return scheduleInfo(raceDate.value)
})

const canSave = computed(() =>
  name.value.trim().length > 0 &&
  planId.value !== null &&
  raceDate.value.length > 0 &&
  (info.value?.valid ?? false)
)

// Remplir le formulaire quand on édite un athlète existant
watch(() => props.athlete, (a) => {
  if (a) {
    name.value = a.name
    email.value = a.email ?? ''
    notes.value = a.notes ?? ''
    assignmentNotes.value = a.assignment?.notes ?? ''
    raceDate.value = a.assignment?.race_date ?? ''
    const pid = a.assignment?.plan_id
    planId.value = typeof pid === 'object' ? pid.id : (pid ?? null)
    if (a.ten_km_time_sec) {
      tenKmMin.value = String(Math.floor(a.ten_km_time_sec / 60))
      tenKmSec.value = String(a.ten_km_time_sec % 60).padStart(2, '0')
    } else {
      tenKmMin.value = ''
      tenKmSec.value = ''
    }
  } else {
    name.value = ''
    email.value = ''
    tenKmMin.value = ''
    tenKmSec.value = ''
    notes.value = ''
    planId.value = null
    raceDate.value = ''
    assignmentNotes.value = ''
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
    const payload = {
      name: name.value.trim(),
      email: email.value.trim() || null,
      ten_km_time_sec: parseTenKm(),
      notes: notes.value.trim() || null,
      planId: planId.value,
      raceDate: raceDate.value,
      assignmentNotes: assignmentNotes.value.trim() || null,
    }
    if (props.athlete) {
      await athleteStore.updateAthlete(props.athlete.id, payload, props.athlete.assignment?.id ?? null)
    } else {
      await athleteStore.createAthlete(payload)
    }
    emit('close')
  } catch (e: any) {
    errorMsg.value = e?.message ?? 'Erreur lors de la sauvegarde'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Overlay -->
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 bg-black/20 z-40" @click="emit('close')" />
  </Transition>

  <!-- Drawer -->
  <Transition name="slide">
    <aside
      v-if="open"
      class="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
        <h2 class="text-sm font-semibold text-slate-900">
          {{ athlete ? 'Modifier l\'athlète' : 'Ajouter un athlète' }}
        </h2>
        <button @click="emit('close')" class="p-1 rounded hover:bg-slate-100 transition-colors">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-5 py-5 space-y-6">

        <!-- Profil -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profil</h3>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Nom *</label>
            <input
              v-model="name"
              type="text"
              placeholder="Marie Dupont"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="marie@example.com"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Temps 10 km</label>
            <div class="flex items-center gap-2">
              <input
                v-model="tenKmMin"
                type="number"
                min="0"
                max="99"
                placeholder="45"
                class="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span class="text-sm text-slate-400">min</span>
              <input
                v-model="tenKmSec"
                type="number"
                min="0"
                max="59"
                placeholder="00"
                class="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span class="text-sm text-slate-400">sec</span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              v-model="notes"
              rows="2"
              placeholder="Observations sur l'athlète..."
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <!-- Affectation -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Affectation</h3>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Plan *</label>
            <select
              v-model="planId"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              <option :value="null" disabled>Sélectionner un plan...</option>
              <option v-for="plan in availablePlans" :key="plan.id" :value="plan.id">
                {{ plan.title }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Date de course *</label>
            <input
              v-model="raceDate"
              type="date"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <!-- Info calcul semaines -->
          <div
            v-if="info"
            class="px-3 py-2 rounded-lg text-xs"
            :class="info.valid ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'"
          >
            {{ info.message }}
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Notes d'affectation</label>
            <textarea
              v-model="assignmentNotes"
              rows="2"
              placeholder="Contexte de l'affectation..."
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <!-- Erreur -->
        <div v-if="errorMsg" class="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {{ errorMsg }}
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
        <button
          @click="emit('close')"
          class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          Annuler
        </button>
        <button
          @click="save"
          :disabled="!canSave || saving"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          :class="canSave && !saving
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'"
        >
          {{ saving ? 'Sauvegarde...' : (athlete ? 'Enregistrer' : 'Ajouter') }}
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

- [ ] **Step 2: Vérifier la compilation**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/athletes/AthleteDrawer.vue
git commit -m "feat: add AthleteDrawer component"
```

---

## Task 8: Composant `AthleteTable`

**Files:**
- Create: `src/components/athletes/AthleteTable.vue`

- [ ] **Step 1: Créer `src/components/athletes/AthleteTable.vue`**

```vue
<script setup lang="ts">
import { useAthleteSchedule } from '@/composables/useAthleteSchedule'
import AthleteWeekBadge from './AthleteWeekBadge.vue'
import type { AthleteWithAssignment } from '@/types'

defineProps<{ athletes: AthleteWithAssignment[] }>()
const emit = defineEmits<{
  edit: [athlete: AthleteWithAssignment]
  delete: [athlete: AthleteWithAssignment]
}>()

const { daysUntilRace } = useAthleteSchedule()

function formatRaceDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date))
}

function planTitle(a: AthleteWithAssignment): string {
  const pid = a.assignment?.plan_id
  if (!pid) return '—'
  return typeof pid === 'object' ? pid.title : `Plan #${pid}`
}

function planId(a: AthleteWithAssignment): number | null {
  const pid = a.assignment?.plan_id
  if (!pid) return null
  return typeof pid === 'object' ? pid.id : pid
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
        <tr
          v-for="athlete in athletes"
          :key="athlete.id"
          class="hover:bg-slate-50 transition-colors group"
        >
          <!-- Athlète -->
          <td class="px-4 py-3">
            <div class="font-medium text-slate-900">{{ athlete.name }}</div>
            <div v-if="athlete.email" class="text-xs text-slate-400">{{ athlete.email }}</div>
          </td>

          <!-- Plan -->
          <td class="px-4 py-3">
            <RouterLink
              v-if="planId(athlete)"
              :to="`/plans/${planId(athlete)}`"
              class="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
            >
              {{ planTitle(athlete) }}
            </RouterLink>
            <span v-else class="text-slate-400">—</span>
          </td>

          <!-- Date de course -->
          <td class="px-4 py-3 text-slate-600">
            <span v-if="athlete.assignment?.race_date">
              {{ formatRaceDate(athlete.assignment.race_date) }}
            </span>
            <span v-else class="text-slate-400">—</span>
          </td>

          <!-- Avancement -->
          <td class="px-4 py-3">
            <AthleteWeekBadge
              v-if="athlete.assignment?.race_date"
              :race-date="athlete.assignment.race_date"
            />
            <span v-else class="text-slate-400">—</span>
          </td>

          <!-- Actions -->
          <td class="px-4 py-3">
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click="emit('edit', athlete)"
                class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Modifier"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="emit('delete', athlete)"
                class="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                title="Supprimer"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        </tr>

        <!-- Empty state -->
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

- [ ] **Step 2: Commit**

```bash
git add src/components/athletes/AthleteTable.vue
git commit -m "feat: add AthleteTable component"
```

---

## Task 9: Vue `AthletesView`

**Files:**
- Create: `src/views/AthletesView.vue`

- [ ] **Step 1: Créer `src/views/AthletesView.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAthleteStore } from '@/stores/athletes'
import { usePlanStore } from '@/stores/plan'
import AthleteTable from '@/components/athletes/AthleteTable.vue'
import AthleteDrawer from '@/components/athletes/AthleteDrawer.vue'
import type { AthleteWithAssignment } from '@/types'

const athleteStore = useAthleteStore()
const planStore = usePlanStore()

const drawerOpen = ref(false)
const editingAthlete = ref<AthleteWithAssignment | null>(null)
const deletingAthlete = ref<AthleteWithAssignment | null>(null)
const deleteConfirming = ref(false)

onMounted(async () => {
  await Promise.all([
    athleteStore.fetchAthletes(),
    planStore.plans?.length ? Promise.resolve() : planStore.fetchPlans?.(),
  ])
})

function openAdd() {
  editingAthlete.value = null
  drawerOpen.value = true
}

function openEdit(athlete: AthleteWithAssignment) {
  editingAthlete.value = athlete
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  editingAthlete.value = null
}

async function confirmDelete(athlete: AthleteWithAssignment) {
  deletingAthlete.value = athlete
}

async function doDelete() {
  if (!deletingAthlete.value) return
  deleteConfirming.value = true
  try {
    await athleteStore.deleteAthlete(deletingAthlete.value.id)
  } finally {
    deletingAthlete.value = null
    deleteConfirming.value = false
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Header -->
    <div class="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-900">Athlètes</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          {{ athleteStore.athletes.length }} athlète{{ athleteStore.athletes.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <button
        @click="openAdd"
        class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Ajouter un athlète
      </button>
    </div>

    <!-- Contenu -->
    <div class="px-8 py-6">
      <!-- Loading -->
      <div v-if="athleteStore.loading" class="flex justify-center py-12">
        <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>

      <!-- Erreur -->
      <div v-else-if="athleteStore.error" class="text-sm text-red-600 py-4">
        {{ athleteStore.error }}
      </div>

      <!-- Tableau -->
      <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <AthleteTable
          :athletes="athleteStore.athletes"
          @edit="openEdit"
          @delete="confirmDelete"
        />
      </div>
    </div>

    <!-- Drawer -->
    <AthleteDrawer
      :open="drawerOpen"
      :athlete="editingAthlete"
      @close="closeDrawer"
    />

    <!-- Modal de confirmation de suppression -->
    <Transition name="fade">
      <div v-if="deletingAthlete" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
          <h3 class="text-sm font-semibold text-slate-900 mb-2">Supprimer l'athlète ?</h3>
          <p class="text-sm text-slate-500 mb-5">
            <strong>{{ deletingAthlete.name }}</strong> et toutes ses affectations seront supprimés définitivement.
          </p>
          <div class="flex justify-end gap-3">
            <button
              @click="deletingAthlete = null"
              class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Annuler
            </button>
            <button
              @click="doDelete"
              :disabled="deleteConfirming"
              class="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {{ deleteConfirming ? 'Suppression...' : 'Supprimer' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 2: Vérifier la compilation**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/views/AthletesView.vue
git commit -m "feat: add AthletesView"
```

---

## Task 10: Corriger les appels `planStore` + vérification finale

`planStore` (dans `src/stores/plan.ts`) expose `plans` (ref réactive) et `loadPlans()`.
Il faut corriger `AthletesView.vue` et `AthleteDrawer.vue` en conséquence.

**Files:**
- Modify: `src/views/AthletesView.vue`
- Modify: `src/components/athletes/AthleteDrawer.vue`

- [ ] **Step 1: Corriger `AthletesView.vue` — remplacer `fetchPlans` par `loadPlans`**

Dans `src/views/AthletesView.vue`, modifier le `onMounted` :

```typescript
onMounted(async () => {
  await Promise.all([
    athleteStore.fetchAthletes(),
    planStore.plans.length === 0 ? planStore.loadPlans() : Promise.resolve(),
  ])
})
```

- [ ] **Step 2: Corriger `AthleteDrawer.vue` — utiliser `planStore.plans` directement**

Dans `src/components/athletes/AthleteDrawer.vue`, `planStore` est déjà importé.
`planStore.plans` est une ref réactive exposée par le store. La computed `availablePlans` fonctionne déjà car elle lit `planStore.plans`. Aucun changement nécessaire si la Task 7 a bien importé `usePlanStore`.

Vérifier que l'import est présent dans `AthleteDrawer.vue` :
```typescript
import { usePlanStore } from '@/stores/plan'
const planStore = usePlanStore()
```

Si `planStore.plans` retourne un tableau vide au moment d'ouvrir le drawer (plans pas encore chargés), l'`AthletesView.vue` a déjà chargé les plans au `onMounted`, donc ce cas ne se produit pas en usage normal.

- [ ] **Step 3: Lancer le dev server et vérifier manuellement**

```bash
npm run dev
```

Vérifier dans le navigateur :
1. Sidebar affiche "Athlètes"
2. `/athletes` charge sans erreur
3. Bouton "Ajouter un athlète" ouvre le drawer
4. Le sélecteur de plans est peuplé
5. Saisir une date de course → le feedback semaines s'affiche
6. Sauvegarder → l'athlète apparaît dans le tableau
7. Cliquer "Modifier" → drawer pré-rempli
8. Cliquer "Supprimer" → confirmation → athlète retiré

- [ ] **Step 4: Vérifier type-check et lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: athletes management — list, add, edit, delete with schedule calculation"
```
