# Drag & Drop Blocs — Design Spec

## Contexte

La vue `/plans/:id/sessions/:sessionId` affiche une liste de blocs (`BlockList.vue`). On y ajoute la possibilité de réordonner les blocs par drag & drop, dans le même style que le D&D existant dans `WeekView.vue`.

## Comportement

- Chaque bloc est draggable
- Un handle `⋮⋮` apparaît au hover à gauche du bloc (côté opposé à la corbeille)
- Pendant le drag : le bloc tiré est à `opacity-50`
- Indicateur de drop : une ligne bleue (`h-0.5 bg-indigo-400`) s'affiche entre les blocs pour indiquer la position d'insertion
- Au drop : réordonnancement immédiat (optimistic update), puis PATCH Directus

## Technique

**Pattern :** HTML5 drag & drop natif, identique à `WeekView.vue`

**État drag (local à `BlockList.vue`) :**
- `draggingIndex` — index du bloc en cours de drag
- `dragOverIndex` — index du bloc survolé (pour afficher la ligne)
- `dragPosition` — `'before' | 'after'` selon si le curseur est dans la moitié haute ou basse du bloc survolé

**Logique de drop :**
1. Calculer le nouvel index cible à partir de `dragOverIndex` + `dragPosition`
2. Réordonner le tableau localement (splice + insert)
3. Renuméroter `position` (1, 2, 3…) pour tous les blocs
4. Émettre `reorder` avec le tableau réordonné

**Persistance (`SessionView.vue`) :**
- `store.currentBlocks` mis à jour immédiatement
- PATCH `session_blocks/:id` avec `{ position }` pour chaque bloc dont la position a changé
- Rollback via `store.loadSession(sessionId)` sur erreur

## Fichiers modifiés

| Action | Fichier |
|--------|---------|
| Modify | `src/components/session/BlockList.vue` |
| Modify | `src/views/SessionView.vue` |

## Contraintes

- Pas de librairie externe (HTML5 natif uniquement)
- Le click sur un bloc pour ouvrir le drawer doit rester fonctionnel (ne pas interférer)
- Le drag ne doit pas se déclencher si on clique sur la corbeille ou le bouton "Annuler"
- Si un seul bloc est présent, le D&D est sans effet (pas de réordonnancement possible)
