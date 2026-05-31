# Session Drag & Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de glisser une séance d'un jour à un autre dans `WeekView`, avec mise à jour optimiste dans Directus via `PATCH /items/sessions/:id { day }`.

**Architecture:** Un seul fichier modifié — `src/views/WeekView.vue`. On ajoute 3 refs de state DnD, 5 event handlers, et la fonction `moveSession`. Le template reçoit `draggable="true"` sur les wrappers de cartes et les events de drop sur les colonnes de jours. Aucune dépendance externe.

**Tech Stack:** Vue 3 Composition API, HTML5 Drag & Drop natif, Directus SDK via `useDirectus`

---

### Task 1 : Ajouter le state DnD et la fonction `moveSession`

**Files:**
- Modify: `src/views/WeekView.vue` (section `<script setup>`)

- [ ] **Step 1 : Ajouter les refs de state DnD**

Dans `<script setup>`, après la déclaration de `directus` (ligne ~13), ajouter :

```typescript
// ── Drag & Drop ──────────────────────────────────────────────────────────────
const draggingSessionId = ref<number | null>(null)
const dragOverDay = ref<string | null>(null)
const dragEnterCount = ref<Record<string, number>>({})
```

- [ ] **Step 2 : Ajouter la fonction `moveSession`**

Juste après les refs ci-dessus, ajouter :

```typescript
async function moveSession(sessionId: number | null, newDay: string) {
  if (!sessionId) return
  const session = store.currentPlan?.weeks
    .flatMap((w) => w.sessions)
    .find((s) => s.id === sessionId)
  if (!session || session.day === newDay) return

  const oldDay = session.day
  session.day = newDay
  try {
    await directus.updateCollectionItem('sessions', sessionId, { day: newDay })
  } catch {
    session.day = oldDay
    await store.loadPlan(planId.value)
  }
}
```

- [ ] **Step 3 : Ajouter les event handlers DnD**

Juste après `moveSession`, ajouter :

```typescript
function onDragStart(sessionId: number) {
  draggingSessionId.value = sessionId
}

function onDragEnd() {
  draggingSessionId.value = null
  dragOverDay.value = null
  dragEnterCount.value = {}
}

function onDragEnter(dayLabel: string) {
  dragEnterCount.value[dayLabel] = (dragEnterCount.value[dayLabel] ?? 0) + 1
  dragOverDay.value = dayLabel
}

function onDragLeave(dayLabel: string) {
  dragEnterCount.value[dayLabel] = Math.max((dragEnterCount.value[dayLabel] ?? 1) - 1, 0)
  if (dragEnterCount.value[dayLabel] === 0 && dragOverDay.value === dayLabel) {
    dragOverDay.value = null
  }
}

function onDrop(dayLabel: string) {
  dragEnterCount.value[dayLabel] = 0
  moveSession(draggingSessionId.value, dayLabel)
  draggingSessionId.value = null
  dragOverDay.value = null
}
```

- [ ] **Step 4 : Vérifier le type-check**

```bash
npm run type-check
```

Attendu : aucune erreur TypeScript.

---

### Task 2 : Modifier le template — cartes draggables

**Files:**
- Modify: `src/views/WeekView.vue` (section `<template>`)

- [ ] **Step 1 : Rendre les wrappers de session cards draggables**

Localiser le bloc (environ ligne 276) :

```html
<div
  v-for="session in sessionsForDay(dayLabel)"
  :key="session.id"
  class="group relative"
>
```

Le remplacer par :

```html
<div
  v-for="session in sessionsForDay(dayLabel)"
  :key="session.id"
  class="group relative transition-opacity"
  draggable="true"
  @dragstart="onDragStart(session.id)"
  @dragend="onDragEnd"
  :class="{ 'opacity-50': draggingSessionId === session.id }"
>
```

- [ ] **Step 2 : Vérifier le type-check**

```bash
npm run type-check
```

Attendu : aucune erreur.

---

### Task 3 : Modifier le template — colonnes drop zones

**Files:**
- Modify: `src/views/WeekView.vue` (section `<template>`)

- [ ] **Step 1 : Ajouter les events de drop sur les colonnes**

Localiser le bloc (environ ligne 273) :

```html
<div v-for="(dayLabel, i) in days" :key="i" class="flex flex-col gap-2">
```

Le remplacer par :

```html
<div
  v-for="(dayLabel, i) in days"
  :key="i"
  class="flex flex-col gap-2 rounded-lg transition-colors"
  @dragenter.prevent="onDragEnter(dayLabel)"
  @dragleave="onDragLeave(dayLabel)"
  @dragover.prevent
  @drop.prevent="onDrop(dayLabel)"
  :class="{
    'ring-2 ring-indigo-400 bg-indigo-50/40 px-1 -mx-1': dragOverDay === dayLabel && draggingSessionId !== null
  }"
>
```

- [ ] **Step 2 : Vérifier le type-check et lint**

```bash
npm run type-check && npm run lint
```

Attendu : aucune erreur.

---

### Task 4 : Vérification manuelle dans le navigateur

- [ ] **Step 1 : Lancer le serveur de dev**

```bash
npm run dev
```

Ouvrir `http://localhost:5173`, naviguer vers une vue semaine avec plusieurs séances.

- [ ] **Step 2 : Tester le cas nominal**

  1. Glisser une séance vers un autre jour → la carte doit apparaître dans le nouveau jour
  2. Pendant le drag : colonne cible surlignée en indigo, carte source à 50% d'opacité
  3. Après le drop : la colonne reprend son apparence normale
  4. Recharger la page → la séance doit être dans le nouveau jour (Directus mis à jour)

- [ ] **Step 3 : Tester le drop sur le même jour**

Glisser une séance et la reposer sur sa propre colonne → aucun appel API, aucun changement visuel.

- [ ] **Step 4 : Tester la gestion d'erreur**

  1. Couper le réseau (DevTools → Network → Offline)
  2. Glisser une séance → la séance revient à sa position d'origine après l'échec

- [ ] **Step 5 : Tester que les liens de navigation sont toujours fonctionnels**

Cliquer sur une SessionCard (sans drag) → doit naviguer vers la vue session normalement.

---

### Task 5 : Commit

- [ ] **Step 1 : Stager et committer**

```bash
git add src/views/WeekView.vue docs/superpowers/specs/2026-05-31-session-drag-drop-design.md docs/superpowers/plans/2026-05-31-session-drag-drop.md
git commit -m "feat: drag-and-drop sessions between days in WeekView"
```
