# Copy Session — Design Spec
_Date: 2026-05-31_

## Objectif

Depuis la vue d'une séance (`SessionView`), permettre au coach de la copier vers une autre date du plan (semaine + jour), en dupliquant intégralement les métadonnées et tous les blocs (avec leurs sous-items).

## Dépendance externe

- Ajouter `@vuepic/vue-datepicker` : datepicker Vue 3 standard, calendrier mensuel, supporte min/max date.

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/components/session/CopySessionDrawer.vue` | Créer — drawer + datepicker + bouton copier |
| `src/views/SessionView.vue` | Modifier — bouton "Copier vers…" + montage du drawer |
| `src/composables/useDirectus.ts` | Modifier — ajouter `copySession()` |

## UX

### Déclencheur

Bouton "Copier vers…" (icône copie) dans le header de `SessionView`, à côté du bouton "Modifier". Visible uniquement en mode lecture (pas pendant `editingSession`).

### Drawer

`CopySessionDrawer` s'ouvre depuis la droite (même pattern que `BlockDrawer`).

**Si `plan.start_date` est défini (cas nominal) :**
- Datepicker calendrier mensuel (`@vuepic/vue-datepicker`)
- `min-date = start_date`, `max-date = start_date + 133 jours` (19 semaines)
- Bouton "Copier" (disabled tant qu'aucune date sélectionnée, loading pendant la copie)
- Bouton "Annuler" → ferme le drawer

**Si `plan.start_date` est null (fallback) :**
- Deux selects à la place du datepicker : "Semaine" (1→19) + "Jour" (Lundi→Dimanche)
- Bouton "Copier" (disabled tant que semaine ou jour non sélectionné)
- La résolution `targetWeekId` se fait via `plan.weeks.find(w => w.week_number === selectedWeek)`

### Après succès

- Drawer se ferme
- Toast inline (même pattern que `BlockDrawer`) : "Séance copiée → Semaine X — Jeudi"

## Logique `copySession(sessionId, targetDate)` dans `useDirectus`

### Résolution semaine + jour

```
targetDay = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][date.getDay()]
```

Si `plan.start_date` est défini :
```
weekIndex = Math.floor((targetDate - startDate) / (7 * 86400000))  // 0-based
targetWeek = plan.weeks.find(w => w.week_number === weekIndex + 1)
```

Si `plan.start_date` est null → fallback selects (voir UX) : `targetWeekId = plan.weeks.find(w => w.week_number === selectedWeekNumber)?.id`.

### Séquence de duplication

```
1. POST /items/sessions — copie métadonnées source (title, type, day=targetDay,
   week_id=targetWeek.id, description, duration_min, intensity_score, focus,
   coach_tip, optional) → newSession

2. Récupérer les session_blocks de la session source (déjà dans store.currentBlocks)

3. Pour chaque ResolvedBlock :

   a. block_cardio / block_intervals :
      POST /items/{block_type} avec tous les champs sauf id → newBlock
      POST /items/session_blocks { session_id: newSession.id, block_type, block_id: newBlock.id, position }

   b. block_strength :
      POST /items/block_strength { rest_sec, note } → newBlock
      Pour chaque exercise dans block.exercises :
        POST /items/block_strength_exercises { block_strength_id: newBlock.id,
          exercise_id: ex.exercise_id.id, position, sets, reps, duration_sec,
          weight_kg, custom_label, note }
      POST /items/session_blocks { session_id: newSession.id, block_type: 'block_strength',
        block_id: newBlock.id, position }

   c. block_circuit / block_mini_race / block_station_activation / block_station_block :
      POST /items/{block_type} avec les champs scalaires → newBlock
      Pour chaque station dans block.stations :
        POST /items/{child_collection} { {block_type}_id: newBlock.id,
          station_id: st.station_id.id, position, distance_m, reps, duration_sec,
          weight_kg_female, weight_kg_male, custom_label, note }
      POST /items/session_blocks { session_id: newSession.id, block_type, block_id: newBlock.id, position }

4. Retourne newSession
```

### Collections enfants par type de bloc

| block_type | collection enfant | clé FK |
|---|---|---|
| `block_strength` | `block_strength_exercises` | `block_strength_id` |
| `block_circuit` | `block_circuit_stations` | `block_circuit_id` |
| `block_mini_race` | `block_mini_race_stations` | `block_mini_race_id` |
| `block_station_activation` | `block_station_activation_entries` | `block_station_activation_id` |
| `block_station_block` | `block_station_block_entries` | `block_station_block_id` |

## Toast

Toast inline dans `CopySessionDrawer` (même pattern que `BlockDrawer` : `toastMsg` + `toastType` refs, affiché en bas du drawer, disparaît après 2s).

## Ce qui ne change pas

- `BlockDrawer.vue` — inchangé
- Logique d'édition et suppression de blocs — inchangée
- `SessionCard.vue` — inchangée
