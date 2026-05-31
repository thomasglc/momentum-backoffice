# Session Drag & Drop — Design Spec
_Date: 2026-05-31_

## Objectif

Permettre au coach de glisser une séance d'un jour à un autre dans la vue semaine (`WeekView`), avec mise à jour immédiate dans Directus.

## Contraintes

- Déplacement uniquement au sein de la semaine courante (entre les 7 colonnes de jours)
- L'ordre des séances dans une colonne n'a pas d'importance
- Utilisation du Drag & Drop HTML5 natif (pas de dépendance externe)
- Usage desktop uniquement (back office coach)

## Architecture

Tout le code est contenu dans `src/views/WeekView.vue`. Aucun nouveau composant.

### État ajouté

```typescript
const draggingSessionId = ref<number | null>(null)
const dragOverDay = ref<string | null>(null)
```

### Source du drag (cartes de session)

Le wrapper `div.group` existant reçoit :
- `draggable="true"`
- `@dragstart` → `draggingSessionId = session.id`
- `@dragend` → reset `draggingSessionId` et `dragOverDay` à `null`
- `:class` → `opacity-50` quand `draggingSessionId === session.id`

Le composant `SessionCard` (RouterLink) reste inchangé.

### Zone de dépôt (colonnes de jours)

Chaque colonne `div` de jour reçoit :
- `@dragenter.prevent` → incrémente un compteur par colonne, `dragOverDay = dayLabel`
- `@dragleave` → décrémente le compteur ; `dragOverDay = null` seulement quand compteur atteint 0
- `@dragover.prevent` → nécessaire pour autoriser le drop (sans logique supplémentaire)
- `@drop` → reset compteur, appelle `moveSession(draggingSessionId, dayLabel)`
- `:class` → `ring-2 ring-indigo-400 bg-indigo-50/40 rounded-lg` quand `dragOverDay === dayLabel && draggingSessionId !== null`

> Note : le compteur (`dragEnterCount: ref<Record<string, number>>`) évite le clignotement causé par les `dragleave` internes quand la souris passe sur un élément enfant (carte, bouton) à l'intérieur de la colonne.

### Fonction `moveSession`

```typescript
async function moveSession(sessionId: number, newDay: string) {
  const session = /* trouver dans store */
  if (!session || session.day === newDay) return

  const oldDay = session.day
  session.day = newDay  // optimistic update

  try {
    await directus.updateCollectionItem('sessions', sessionId, { day: newDay })
  } catch {
    session.day = oldDay  // rollback
    await store.loadPlan(planId.value)
  }
}
```

## Feedback visuel

| État | Rendu |
|------|-------|
| Card en cours de drag | `opacity-50` sur le wrapper |
| Colonne survolée | `ring-2 ring-indigo-400 bg-indigo-50/40` |
| Succès | Update visuel immédiat (pas de toast) |
| Erreur | Rollback silencieux + reload plan |

## Ce qui ne change pas

- `SessionCard.vue` — aucune modification
- Logique d'ajout et suppression de sessions — inchangée
- Navigation clavier entre semaines — inchangée
