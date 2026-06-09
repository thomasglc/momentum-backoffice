# Gestion des Athlètes — Design Spec
Date : 2026-06-08

## Contexte

Le coach a besoin de gérer ses athlètes dans le back office : leur assigner un plan d'entraînement Hyrox (19 semaines), une date de course, et visualiser où chaque athlète en est dans son plan. Un athlète peut rejoindre le programme en cours de route (minimum 12 semaines requises).

## Décisions clés

- Les athlètes sont des **profils coach-only** (pas de compte de connexion).
- Le **plan est un template partagé** — chaque athlète a sa propre date de course, les semaines sont calculées depuis cette date.
- La **logique de calcul de dates est entièrement frontend** (composable pur).
- L'affectation athlète↔plan vit dans une table de jonction dédiée pour permettre plusieurs saisons.

---

## 1. Schéma de données

### Nouvelles tables PostgreSQL (migration directe sur la DB Directus)

```sql
CREATE TABLE athletes (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  ten_km_time_sec INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE athlete_plan_assignments (
  id          SERIAL PRIMARY KEY,
  athlete_id  INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  plan_id     INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  race_date   DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

La table `athlete_profiles` existante est laissée en place mais non utilisée par cette feature.

### Logique de calcul de semaines

- Semaine 19 du plan = semaine calendaire contenant `race_date`
- Semaine N du plan = `race_date - (19 - N) * 7 jours`
- `currentWeek = 19 - floor((raceDate - today) / 7)`
- Si `currentWeek < 1` : plan non encore démarré
- Si `currentWeek > 19` : plan terminé
- Minimum 12 semaines : si `race_date - today < 12 * 7` → invalide

---

## 2. UI

### Route `/athletes`

Nouvelle entrée dans la sidebar (icône Users), entre Plans et le reste.

**Liste des athlètes** — tableau compact :
| Colonne | Contenu |
|---------|---------|
| Nom | Texte |
| Plan | Badge cliquable → `/plans/:id` |
| Date de course | "15 mars 2026" |
| Avancement | "Semaine 7 / 19" |
| Jours restants | "84 jours" |
| Alerte | Badge rouge si < 12 semaines |
| Actions | Modifier, Supprimer |

Bouton "Ajouter un athlète" → side drawer.

### Side drawer Ajout / Édition

**Section Profil :**
- Nom (requis)
- Email (optionnel)
- Temps 10km (optionnel, en mm:ss)
- Notes

**Section Affectation :**
- Sélecteur de plan (plans `active` uniquement)
- Date de course (date picker)

**Feedback temps réel sous la date :**
- Cas normal : "Plan démarrera à la semaine 4 (J-112). Semaines 1 à 3 non couvertes."
- Cas invalide : "⚠ Seulement 10 semaines — minimum 12 requis" (bouton Enregistrer désactivé)
- Cas complet : "Plan complet — 19 semaines couvertes."

---

## 3. Architecture de code

### Nouveaux fichiers

```
src/
├── views/
│   └── AthletesView.vue
├── components/
│   └── athletes/
│       ├── AthleteTable.vue
│       ├── AthleteDrawer.vue
│       └── AthleteWeekBadge.vue
├── stores/
│   └── athletes.ts
├── composables/
│   └── useAthleteSchedule.ts
```

### `useAthleteSchedule.ts`

Composable pur (pas de requêtes HTTP) :

```ts
weekForDate(raceDate: string, date: string): number   // semaine 1-19
currentWeek(raceDate: string): number                  // semaine du jour
startDate(raceDate: string): string                    // date semaine 1
weeksSkipped(raceDate: string): number                 // semaines non couvertes
isValid(raceDate: string): boolean                     // >= 12 semaines
```

### `athletes.ts` store (Pinia)

Actions : `fetchAthletes()`, `createAthlete()`, `updateAthlete()`, `deleteAthlete()`.
Chaque athlète est chargé avec son assignment courant via `?fields=*,assignments.*,assignments.plan_id.*`.

### Modifications fichiers existants

- `AppSidebar.vue` — entrée "Athlètes"
- `router/index.ts` — route `/athletes`
- `types/index.ts` — types `Athlete`, `AthleteAssignment`

---

## 4. Migration DB

1. Exécuter le SQL de création des tables sur le PostgreSQL Directus
2. Déclarer `athletes` et `athlete_plan_assignments` dans le snapshot Directus (`snapshot.yaml`) pour exposer `/items/athletes` et `/items/athlete_plan_assignments` via l'API REST

---

## Hors scope

- Vue dédiée `/athletes/:id`
- Historique de plusieurs plans par athlète (la table le supporte, l'UI n'en a pas besoin maintenant)
- Notifications ou rappels de course
