# Copy Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depuis `SessionView`, permettre de copier une séance (métadonnées + tous les blocs) vers une autre date du plan via un side drawer avec datepicker.

**Architecture:** 4 fichiers modifiés/créés. `copySession()` est ajouté à `useDirectus.ts` et orchestre la duplication Directus en séquence. `CopySessionDrawer.vue` est un nouveau composant autonome (pattern identique à `BlockDrawer`) qui contient le datepicker `@vuepic/vue-datepicker` et la logique de résolution semaine+jour. `SessionView.vue` monte le drawer via `v-if` et expose un bouton "Copier vers…".

**Tech Stack:** Vue 3 Composition API, `@vuepic/vue-datepicker`, Directus SDK, TypeScript

---

### Task 1 : Installer @vuepic/vue-datepicker et importer son CSS

**Files:**
- Modify: `package.json` (via npm)
- Modify: `src/main.ts`

- [ ] **Step 1 : Installer la dépendance**

```bash
npm install @vuepic/vue-datepicker
```

Attendu : package ajouté dans `node_modules/@vuepic/vue-datepicker`.

- [ ] **Step 2 : Importer le CSS du datepicker dans `src/main.ts`**

Localiser `src/main.ts` (actuellement 13 lignes). Ajouter l'import CSS après `import './style.css'` :

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './style.css'
import '@vuepic/vue-datepicker/dist/main.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
```

- [ ] **Step 3 : Vérifier que le build ne casse pas**

```bash
npm run type-check
```

Attendu : aucune erreur.

---

### Task 2 : Ajouter `copySession` dans `useDirectus.ts`

**Files:**
- Modify: `src/composables/useDirectus.ts`

- [ ] **Step 1 : Mettre à jour la ligne d'import des types**

Localiser la ligne 2 de `src/composables/useDirectus.ts` :

```typescript
import type { Plan, AnyBlock, BlockType } from '@/types'
```

La remplacer par :

```typescript
import type { Plan, AnyBlock, BlockType, Session, ResolvedBlock } from '@/types'
```

- [ ] **Step 2 : Ajouter la fonction `copySession` avant le `return`**

Dans `useDirectus.ts`, juste avant `return {`, ajouter :

```typescript
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
```

- [ ] **Step 3 : Exporter `copySession` dans le `return`**

Localiser le bloc `return {` en fin de `useDirectus.ts`. Ajouter `copySession` à la liste :

```typescript
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
```

- [ ] **Step 4 : Vérifier le type-check**

```bash
npm run type-check
```

Attendu : aucune erreur TypeScript.

- [ ] **Step 5 : Commit**

```bash
git add src/composables/useDirectus.ts src/main.ts
git commit -m "feat: add copySession to useDirectus + install vue-datepicker"
```

---

### Task 3 : Créer `CopySessionDrawer.vue`

**Files:**
- Create: `src/components/session/CopySessionDrawer.vue`

- [ ] **Step 1 : Créer le fichier**

Créer `src/components/session/CopySessionDrawer.vue` avec le contenu complet suivant :

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import VueDatePicker from '@vuepic/vue-datepicker'
import { useDirectus } from '@/composables/useDirectus'
import type { Session, Plan, ResolvedBlock } from '@/types'

const props = defineProps<{
  session: Session
  blocks: ResolvedBlock[]
  plan: Plan
}>()

const emit = defineEmits<{ close: [] }>()

const directus = useDirectus()
const isCopying = ref(false)
const selectedDate = ref<Date | null>(null)
const selectedWeekNumber = ref<number | null>(null)
const selectedDay = ref<string>('')
const showToast = ref(false)
const toastMsg = ref('')
const toastType = ref<'success' | 'error'>('success')

const hasStartDate = computed(() => !!props.plan.start_date)

const minDate = computed(() => {
  if (!props.plan.start_date) return undefined
  return new Date(props.plan.start_date)
})

const maxDate = computed(() => {
  if (!props.plan.start_date) return undefined
  const d = new Date(props.plan.start_date)
  d.setDate(d.getDate() + 132)
  return d
})

const weekNumbers = computed(() =>
  [...props.plan.weeks].map(w => w.week_number).sort((a, b) => a - b)
)

const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const canCopy = computed(() => {
  if (isCopying.value) return false
  if (hasStartDate.value) return selectedDate.value !== null
  return selectedWeekNumber.value !== null && selectedDay.value !== ''
})

function resolveTarget(): { weekId: number; day: string } | null {
  if (hasStartDate.value && selectedDate.value) {
    const startRaw = new Date(props.plan.start_date!)
    const start = new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate())
    const target = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate())
    const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000)
    const weekNumber = Math.floor(diffDays / 7) + 1
    const week = props.plan.weeks.find(w => w.week_number === weekNumber)
    if (!week) return null
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    return { weekId: week.id, day: dayNames[selectedDate.value.getDay()] }
  }
  if (selectedWeekNumber.value && selectedDay.value) {
    const week = props.plan.weeks.find(w => w.week_number === selectedWeekNumber.value)
    if (!week) return null
    return { weekId: week.id, day: selectedDay.value }
  }
  return null
}

function showToastMessage(msg: string, type: 'success' | 'error') {
  toastMsg.value = msg
  toastType.value = type
  showToast.value = true
  setTimeout(() => (showToast.value = false), 3000)
}

async function handleCopy() {
  const target = resolveTarget()
  if (!target) return
  isCopying.value = true
  try {
    await directus.copySession(props.session, props.blocks, target.weekId, target.day)
    const targetWeek = props.plan.weeks.find(w => w.id === target.weekId)
    showToastMessage(`Séance copiée → Semaine ${targetWeek?.week_number} — ${target.day}`, 'success')
    setTimeout(() => emit('close'), 1500)
  } catch {
    showToastMessage('Erreur lors de la copie', 'error')
  } finally {
    isCopying.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black/20" @click="emit('close')" />

  <div class="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-white shadow-xl border-l border-slate-200 flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
      <h2 class="font-semibold text-slate-900">Copier vers…</h2>
      <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      <template v-if="hasStartDate">
        <p class="text-sm text-slate-500">Choisissez une date dans le plan :</p>
        <VueDatePicker
          v-model="selectedDate"
          :min-date="minDate"
          :max-date="maxDate"
          inline
          auto-apply
          :enable-time-picker="false"
        />
      </template>

      <template v-else>
        <p class="text-sm text-slate-500">Ce plan n'a pas de date de début. Choisissez manuellement :</p>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Semaine</label>
          <select
            v-model="selectedWeekNumber"
            class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option :value="null" disabled>Choisir une semaine</option>
            <option v-for="n in weekNumbers" :key="n" :value="n">Semaine {{ n }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Jour</label>
          <select
            v-model="selectedDay"
            class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="" disabled>Choisir un jour</option>
            <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
      </template>
    </div>

    <div class="px-6 py-4 border-t border-slate-200 flex gap-2">
      <button
        @click="handleCopy"
        :disabled="!canCopy"
        class="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
      >
        <span v-if="isCopying">Copie en cours…</span>
        <span v-else>Copier</span>
      </button>
      <button
        @click="emit('close')"
        class="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
      >
        Annuler
      </button>
    </div>
  </div>

  <Transition
    enter-from-class="opacity-0 translate-y-2"
    enter-active-class="transition duration-200"
    leave-to-class="opacity-0"
    leave-active-class="transition duration-200"
  >
    <div
      v-if="showToast"
      class="fixed bottom-4 right-4 z-[60] px-4 py-3 rounded-lg shadow text-sm font-medium text-white"
      :class="toastType === 'success' ? 'bg-emerald-500' : 'bg-red-500'"
    >
      {{ toastMsg }}
    </div>
  </Transition>
</template>
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
npm run type-check
```

Attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/session/CopySessionDrawer.vue
git commit -m "feat: add CopySessionDrawer component"
```

---

### Task 4 : Câbler le drawer dans `SessionView.vue`

**Files:**
- Modify: `src/views/SessionView.vue`

- [ ] **Step 1 : Ajouter l'import du drawer**

Dans `<script setup>` de `SessionView.vue`, ajouter parmi les imports existants :

```typescript
import CopySessionDrawer from '@/components/session/CopySessionDrawer.vue'
```

- [ ] **Step 2 : Ajouter le ref de contrôle**

Juste après `const showAddPicker = ref(false)` (ligne ~22), ajouter :

```typescript
const showCopyDrawer = ref(false)
```

- [ ] **Step 3 : Ajouter le bouton "Copier vers…" dans le header**

Dans le template, localiser le bloc suivant (dans la section `v-if="!editingSession"`, après le bouton "Modifier") :

```html
            <button
              @click="openEditSession"
              class="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
              </svg>
              Modifier
            </button>
```

Le remplacer par :

```html
            <button
              @click="openEditSession"
              class="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
              </svg>
              Modifier
            </button>
            <button
              @click="showCopyDrawer = true"
              class="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copier vers…
            </button>
```

- [ ] **Step 4 : Monter le drawer en bas du template**

Localiser le bloc `<BlockDrawer` en bas du template de `SessionView.vue` :

```html
      <BlockDrawer
        v-if="editingBlock"
        :block="editingBlock"
        @close="editingBlock = null"
        @saved="editingBlock = null; store.loadSession(sessionId)"
      />
```

Ajouter le drawer de copie juste après :

```html
      <CopySessionDrawer
        v-if="showCopyDrawer && session && store.currentPlan"
        :session="session"
        :blocks="blocks"
        :plan="store.currentPlan"
        @close="showCopyDrawer = false"
      />
```

- [ ] **Step 5 : Vérifier le type-check et lint**

```bash
npm run type-check && npm run lint
```

Attendu : aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add src/views/SessionView.vue
git commit -m "feat: wire CopySessionDrawer into SessionView"
```

---

### Task 5 : Vérification manuelle dans le navigateur

- [ ] **Step 1 : Lancer le serveur de dev**

```bash
npm run dev
```

Ouvrir `http://localhost:5173`, naviguer vers une vue session avec des blocs.

- [ ] **Step 2 : Tester le cas nominal (plan avec start_date)**

  1. Cliquer "Copier vers…" → drawer s'ouvre depuis la droite avec un calendrier
  2. Sélectionner une date dans la plage du plan → bouton "Copier" s'active
  3. Cliquer "Copier" → spinner, puis toast vert "Séance copiée → Semaine X — Jeudi", drawer se ferme
  4. Naviguer vers la vue semaine de la date choisie → la séance copiée est présente avec tous ses blocs

- [ ] **Step 3 : Tester que les blocs sont bien copiés**

  Ouvrir la séance copiée → les blocs doivent être identiques à la source (mêmes types, mêmes données, mêmes sous-items).

- [ ] **Step 4 : Tester la sélection hors plage**

  Le calendrier ne doit pas permettre de sélectionner des dates avant `start_date` ou après `start_date + 19 semaines` (dates grisées).

- [ ] **Step 5 : Tester l'annulation**

  Ouvrir le drawer → cliquer "Annuler" ou cliquer sur l'overlay → le drawer se ferme sans rien créer.

- [ ] **Step 6 : Tester l'erreur réseau**

  1. Ouvrir le drawer, sélectionner une date
  2. DevTools → Network → Offline
  3. Cliquer "Copier" → toast rouge "Erreur lors de la copie", bouton revient à l'état normal
