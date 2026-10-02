# Étape 3, lot 1 — le coach voit qui s'entraîne

Date : 2 octobre 2026. Source : audit UX du dépôt de l'app athlète (`docs/audit-ux-2026-10-02.md`, section 4 et étape 3). Spec et plan condensés dans ce seul document.

## But

Le CRM affiche la semaine théorique de chaque athlète, pas ce qu'il a fait. Le coach doit voir en arrivant : qui s'entraîne, qui décroche, et le détail d'un athlète.

## Découpage de l'étape 3

| Lot | Actions de l'audit | Dépôt | Directus |
|---|---|---|---|
| **1 (ce document)** | 3.1 tableau de bord de suivi, 3.2 fiche athlète | CRM | aucun changement |
| 2 | 3.3 créer un plan, ajouter et dupliquer une semaine, dupliquer un plan | CRM | aucun |
| 3 | 3.4 catalogue et images, notes d'exercice affichées | CRM | aucun |
| 4 | 3.5 saisie des stations et des courses, chronos AMRAP et EMOM | app athlète | à définir |

Écarté du lot 1 : les notes du coach sur un athlète. C'est une saisie ; il faut d'abord décider où elle ressort (mémo privé du coach, ou message montré à l'athlète).

## Ce que voit le coach

**Suivi** (`/suivi`, nouvelle page d'arrivée). Une ligne par athlète :

| Colonne | Contenu |
|---|---|
| Athlète | nom ; pastille « À relancer » |
| Plan | titre ; « S3 / 19 », « Commence dans 3 j », « Terminé » ou « Sans date de course » |
| Cette semaine | sept points lundi-dimanche (validée, à rattraper, à faire, repos) et « 3 / 6 » |
| Dernière activité | « aujourd'hui », « il y a 5 j », « jamais » : dernière validation ou dernière série enregistrée |
| Assiduité | part des séances obligatoires échues qui sont validées |

Tri : plans en cours d'abord, les athlètes à relancer en tête. Une ligne ouvre la fiche.

**À relancer** : plan en cours et aucune activité depuis 7 jours (ou jamais, 7 jours après le début du plan).

**Fiche athlète** (`/athletes/:profileId`) : où il en est (semaine, compte à rebours), cinq totaux (séances, assiduité, heures, volume, distance), la frise du plan, ses charges par exercice (première séance → dernière), et semaine par semaine chaque séance avec son état, sa date de validation, sa durée, sa distance et les séries enregistrées.

## Règles

Les mêmes que dans l'app athlète (`src/utils/progress.js` de son dépôt), portées ici en TypeScript : calendrier par athlète depuis la date de course et `plans.total_weeks` ; semaine complète ; assiduité ; heures réelles quand elles sont notées ; charge d'un exercice = sa plus lourde série de la séance.

## Code

- `src/utils/planCalendar.ts`, `src/utils/progress.ts` : logique portée de l'app athlète ; `src/utils/tracking.ts` : ligne de suivi d'un athlète, règle de relance. Testés par `npm test` (`node --test`, types retirés à la volée).
- `src/composables/useDirectus.ts` : lecture des validations, des séries, de la dernière série par athlète.
- `src/stores/tracking.ts` : athlètes, plans, validations ; lignes du tableau.
- `src/views/TrackingView.vue`, `src/views/AthleteDetailView.vue`, `src/components/tracking/*`.
- `src/router/index.ts`, `src/components/layout/AppSidebar.vue` : entrée « Suivi », page d'arrivée.

## Plan

- [ ] Logique et tests.
- [ ] Lectures Directus et store.
- [ ] Page Suivi, fiche athlète, navigation.
- [ ] Vérification sur le faux Directus local avec des athlètes fictifs (aucune donnée personnelle de prod) ; `npm test`, `npm run build` (vérification des types comprise).
