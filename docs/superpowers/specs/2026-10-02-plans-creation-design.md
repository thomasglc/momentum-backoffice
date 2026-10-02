# Étape 3, lot 2 — créer et dupliquer des plans et des semaines

Date : 2 octobre 2026. Suite de `2026-10-02-suivi-athletes-design.md`. Spec et plan condensés dans ce seul document.

## But

Le CRM sait modifier un plan existant, pas en créer un : il a fallu un script pour écrire le plan solo. Le coach doit pouvoir monter un plan sans quitter le CRM : créer le plan, ajouter des semaines, repartir d'une semaine ou d'un plan déjà écrit.

## Ce que fait le coach

| Geste | Où | Résultat |
|---|---|---|
| Nouveau plan | liste des plans | un plan en brouillon, sans semaine ; le CRM ouvre sa page |
| Durée et noms de phases | tiroir du plan (création et modification) | `total_weeks` et `phase_names`, dont dépend le calendrier de chaque athlète |
| Ajouter une semaine | page du plan | une semaine vide en fin de plan, dans la phase de la précédente ; le CRM l'ouvre |
| Dupliquer une semaine | carte de la semaine | une copie en fin de plan : séances, blocs, exercices et stations |
| Changer la phase d'une semaine | modification de la semaine | champ « Phase », à côté du thème et de la décharge |
| Dupliquer un plan | carte du plan | « Titre (copie) » en brouillon, avec toutes ses semaines ; l'avancement s'affiche semaine par semaine |

Hors lot : supprimer une semaine ou un plan (destructif, et des validations d'athlètes peuvent y être rattachées), insérer une semaine au milieu (renumérotation).

## Copie

- La copie relit la source dans Directus (séances, blocs par type, lignes d'exercices et de stations), puis crée par lots : séances, blocs, lignes, liaisons. Une semaine demande une quinzaine de requêtes ; un plan se copie semaine par semaine.
- Seuls les champs propres à chaque collection sont recopiés (listes explicites). Les champs relationnels inverses que Directus renvoie (`exercises`, `stations`) ne sont jamais renvoyés : ils rattacheraient les lignes de la source à la copie.
- Le `slug` d'une séance est unique : la copie n'en a pas.
- Les lignes créées sont rapprochées de leur source par ordre d'identifiant, après contrôle de leur nombre et d'un champ témoin. Au moindre écart, la copie s'arrête avec un message.
- Une copie de plan interrompue laisse un brouillon incomplet, signalé à l'écran.

## Code

- `src/utils/duplicate.ts` : `copyWeek`, `copyPlan`, sur une petite interface de lecture et de création par lots. Testé sans Directus (`tests/duplicate.test.ts`).
- `src/composables/useDirectus.ts` : cette interface au-dessus du SDK ; création de plan et de semaine.
- `src/stores/plan.ts` : `createPlan`, `addWeek`, `duplicateWeek`, `duplicatePlan`.
- `src/views/PlansView.vue`, `PlanView.vue`, `WeekView.vue`, `src/components/plan/WeekCard.vue`.

## Plan

- [ ] Tests puis `duplicate.ts`.
- [ ] Lectures et créations Directus, store.
- [ ] Écrans : nouveau plan, durée et phases, ajouter et dupliquer une semaine, dupliquer un plan, phase d'une semaine.
- [ ] Vérification sur une copie locale en mémoire des données de structure (aucune écriture en prod) : la semaine copiée est identique à sa source, la source est intacte. `npm test`, `npm run build`.
