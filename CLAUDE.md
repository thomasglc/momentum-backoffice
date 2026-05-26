# Momentum — Back Office Coach

Application Vue 3 de gestion de plans d'entraînement Hyrox.
Back office destiné à un coach sportif pour consulter et ajuster des programmes.

## Stack technique

- Vue 3 + `<script setup>` + TypeScript (composition API uniquement)
- Vite 8 + @tailwindcss/vite (Tailwind v4)
- Vue Router 5
- Pinia 3
- @directus/sdk v21 (client REST)
- @vueuse/core

## Commandes

```bash
npm run dev       # dev server http://localhost:5173
npm run build     # build de production
npm run type-check
npm run lint
```

## API Directus

- Base URL : `http://localhost:8056`
- Auth : `POST /auth/login` `{ email, password }` → `access_token` (Bearer)
- Credentials : `thomas.galocha@hotmail.fr` / `thomas67`

---

## Mission : construire le back office

### Contexte métier

Momentum gère des plans d'entraînement Hyrox. Hyrox est une compétition
fitness combinant course à pied et 8 stations de force/cardio (SkiErg,
RowErg, Sled Push/Pull, Burpee Broad Jump, Farmers Carry, Sandbag Lunges,
Wall Balls).

Un plan se structure ainsi :
```
Plan → Semaines (19) → Sessions (par jour) → Blocs (ordonnés)
```

Types de sessions : `running`, `hyrox`, `brick`, `strength`, `mobility`, `recovery`, `race`

Types de blocs (collections Directus distinctes) :
- `block_cardio`           — course, échauffement, récup, brick_run, allure cible
- `block_intervals`        — intervalles (N× distance/durée @ zone)
- `block_strength`         — musculation → exercices liés
- `block_circuit`          — circuit Hyrox → stations liées
- `block_mini_race`        — simulation mini-course → stations liées
- `block_station_activation` — activation technique stations
- `block_station_block`    — brick format (standard, pyramid, follow_the_leader)

### Schéma de données Directus

#### Collections et champs

```
plans             id, title, description, start_date, sport, level, status

weeks             id, plan_id → plans, week_number, phase, theme,
                  is_deload, week_note
                  [O2M] sessions

sessions          id, week_id → weeks, day, type, optional, title,
                  description, duration_min, intensity_score (1-10),
                  focus, coach_tip, slug
                  [M2A] blocks → session_blocks

session_blocks    id, session_id → sessions, position, block_type, block_id
                  (jonction M2A : block_type = nom collection, block_id = id item)

block_cardio      id, subtype (warmup|run|cooldown|brick_run|target_pace),
                  duration_min, pace_zone (Z1|Z2|Z3|Z4|Z5|threshold|race),
                  label, note

block_intervals   id, sets, distance_km, duration_min, recovery_min,
                  pace_zone, note

block_strength    id, rest_sec, note
                  [O2M] exercises → block_strength_exercises

block_strength_exercises
                  id, block_strength_id, exercise_id → exercise_catalog,
                  position, sets, reps, duration_sec, weight_kg,
                  custom_label, note

block_circuit     id, format (rounds|time|amrap), label, rounds,
                  duration_min, rest_between_min, note
                  [O2M] stations → block_circuit_stations

block_circuit_stations
                  id, block_circuit_id, station_id → station_catalog,
                  position, distance_m, reps, duration_sec,
                  weight_kg_female, weight_kg_male, custom_label, note

block_mini_race   id, rounds, run_distance_km, pace_zone,
                  rest_between_rounds_min, note
                  [O2M] stations → block_mini_race_stations
                  (mêmes champs que block_circuit_stations)

block_station_activation
                  id, rounds, note
                  [O2M] stations → block_station_activation_entries
                  (mêmes champs que block_circuit_stations)

block_station_block
                  id, brick_format (standard|pyramid|follow_the_leader),
                  format_note
                  [O2M] stations → block_station_block_entries
                  (mêmes champs que block_circuit_stations)

station_catalog   id, name, measurement_type, default_unit,
                  is_hyrox_official, notes

exercise_catalog  id, name, category, equipment, notes
```

#### Requêtes clés

```typescript
// Plan avec toutes les semaines et sessions (sans le détail des blocs)
GET /items/plans/3?fields=*,weeks.*,weeks.sessions.*

// Détail d'une session avec ses blocs (ne charge que les IDs + types)
GET /items/sessions/:id?fields=*,blocks.*

// Détail d'un bloc strength avec exercices et catalogue
GET /items/block_strength/:id?fields=*,exercises.*,exercises.exercise_id.*

// Détail d'un bloc circuit avec stations et catalogue
GET /items/block_circuit/:id?fields=*,stations.*,stations.station_id.*
```

---

## Ce que tu dois construire

### Routes

```
/                         → redirect vers /plans
/login                    → page de connexion
/plans                    → liste des plans
/plans/:id                → vue plan (timeline 19 semaines)
/plans/:id/weeks/:weekId  → vue semaine (agenda)
/plans/:id/sessions/:sessionId → vue session (blocs détaillés)
```

### 1. Authentification

- Page `/login` : formulaire email/password simple et épuré
- `authStore` (Pinia) : gère token, refresh, état connecté
- Composable `useDirectus.ts` : instancie le client SDK, expose les méthodes
- Guard de navigation : redirige vers `/login` si non authentifié

### 2. Vue Plan — Timeline des semaines

Affichage grille des 19 semaines, organisées par phase.

Chaque carte de semaine contient :
- Numéro de semaine + numéro de phase
- Thème de la semaine
- Badge "Décharge" si `is_deload = true`
- Nombre de séances + durée totale estimée
- Mini-visualisation de la charge (barre ou points basés sur
  `intensity_score` moyen des sessions)
- Click → vue semaine

Les semaines de décharge sont visuellement distinctes (fond légèrement
différent, badge dédié).

### 3. Vue Semaine — Agenda

Layout principal : 7 colonnes (Lundi → Dimanche), une colonne par jour.

Header : numéro de semaine, phase, thème, note coach, badge décharge.
Navigation prev/next semaine.

Chaque colonne affiche les sessions du jour. Carte session :
- Icône + couleur selon le type
- Titre
- Durée + score d'intensité
- Badge "Optionnel" si applicable
- Click → vue session (ou side drawer)

Color coding des types de session :
- `running`  → bleu   (#3B82F6)
- `hyrox`    → orange (#F97316)
- `brick`    → amber  (#F59E0B)
- `strength` → violet (#8B5CF6)
- `mobility` → vert   (#10B981)
- `recovery` → gris   (#6B7280)
- `race`     → rouge  (#EF4444)

### 4. Vue Session — Détail des blocs

Header : titre, jour, type (badge coloré), durée, intensité (barre 1-10),
focus, coach_tip (stylisé différemment — italic, encadré).

Liste verticale des blocs dans l'ordre (`position`).
Chaque bloc est une carte avec rendu spécifique :

**block_cardio**
```
[icône] ÉCHAUFFEMENT · 10 min · Z2
        "5 min rameur Z1 + mobilité"
```

**block_intervals**
```
[icône] INTERVALLES · 6× · 1 km · Z4 · récup 1:30
```

**block_strength**
```
[icône] MUSCULATION · repos 90s
        Back Squat      5 × 5
        Leg Press       4 × 8
        Pull-up         4 × 8
        KB Swing        3 × 15
```

**block_circuit**
```
[icône] CIRCUIT · rounds × 2 · repos 2 min
        SkiErg           150 m
        Farmers Carry    2×30 m    F 14 kg / H 20 kg
        Wall Balls       10 reps   6 kg
        Burpee Broad Jump 5 reps
```

**block_mini_race**
```
[icône] MINI RACE · 4 rounds · 1 km @ Z4 · récup 1:30
        SkiErg       400 m
        RowErg       400 m
        Wall Balls   40 reps   F 6 kg / H 9 kg
```

**block_station_activation**
```
[icône] ACTIVATION · Note: "Volume -40%, technique uniquement"
        SkiErg       200 m
        RowErg       200 m
        Wall Balls   30 reps
```

**block_station_block**
```
[icône] BRICK · Pyramide
        "Distances progressives à chaque round"
        SkiErg        300 m
        Run           1 km
        Farmers Carry 60 m
```

### 5. Édition

- Chaque carte de bloc a un bouton modifier (visible au hover)
- Ouvre un **side drawer** glissant depuis la droite
- Le formulaire est adapté au type de bloc
- Pour les listes (exercices, stations) : réordonnables (drag simple) + "Ajouter"
- Les selects de catalogue chargent `exercise_catalog` / `station_catalog`
- Sauvegarde via `PATCH /items/{collection}/{id}`
- Optimistic update + toast succès/erreur

---

## Design — Thème CLAIR

Interface **light** professionnelle, style coach/SaaS moderne.
Référence visuelle : Linear, Notion, Vercel (mode clair).

```
Fond principal    : #F8FAFC (slate-50)
Cards / surfaces  : #FFFFFF avec border-slate-200 et shadow légère
Texte principal   : #0F172A (slate-900)
Texte secondaire  : #64748B (slate-500)
Séparateurs       : #E2E8F0 (slate-200)
Accent primaire   : #6366F1 (indigo-500) — couleur principale de l'app
Hover states      : #F1F5F9 (slate-100)
```

Typographie : Inter (Google Fonts ou system-ui fallback)

Principes UX :
- Densité **compacte** — le coach voit le max sans scroller
- Pas de modales — side drawers et inline edits
- Hiérarchie visuelle forte : titres bien distincts des metadata
- Les `coach_tip` ont un style distinct (fond légèrement coloré, italic)
- Les badges de zone pace (Z1-Z5) sont color-coded :
  Z1 → vert clair, Z2 → vert, Z3 → jaune, Z4 → orange, Z5 → rouge
- Score d'intensité : barre de 10 segments (plein/vide selon score)
- Les poids F/H sont présentés avec couleurs distinctes :
  F → rose/mauve, H → bleu

Navigation :
- Sidebar gauche fixe et compacte (icônes + labels)
- Breadcrumb pour situer l'utilisateur dans la hiérarchie Plan > Semaine > Session
- Transitions légères entre les vues (pas d'animations lourdes)

---

## Architecture de code attendue

```
src/
├── composables/
│   └── useDirectus.ts        # client SDK + helpers auth
├── stores/
│   ├── auth.ts               # authStore : token, user, login/logout
│   └── plan.ts               # planStore : plan courant, weeks, sessions
├── types/
│   └── index.ts              # tous les types TypeScript du domaine
├── views/
│   ├── LoginView.vue
│   ├── PlansView.vue
│   ├── PlanView.vue          # timeline semaines
│   ├── WeekView.vue          # agenda
│   └── SessionView.vue       # blocs détaillés
├── components/
│   ├── layout/
│   │   ├── AppSidebar.vue
│   │   └── AppBreadcrumb.vue
│   ├── plan/
│   │   └── WeekCard.vue
│   ├── week/
│   │   └── SessionCard.vue
│   ├── session/
│   │   ├── BlockList.vue
│   │   └── blocks/
│   │       ├── BlockCardio.vue
│   │       ├── BlockIntervals.vue
│   │       ├── BlockStrength.vue
│   │       ├── BlockCircuit.vue
│   │       ├── BlockMiniRace.vue
│   │       ├── BlockStationActivation.vue
│   │       └── BlockStationBlock.vue
│   ├── editor/
│   │   ├── BlockDrawer.vue   # side drawer générique
│   │   └── forms/            # un formulaire par type de bloc
│   └── ui/
│       ├── PaceZoneBadge.vue
│       ├── IntensityBar.vue
│       ├── SessionTypeBadge.vue
│       └── AppToast.vue
└── router/
    └── index.ts              # routes + guard auth
```

## Ordre de construction recommandé

1. Types TypeScript complets (`src/types/index.ts`)
2. `useDirectus.ts` + `authStore` + page login
3. Guard de navigation + test auth
4. `planStore` avec chargement plan/weeks/sessions
5. Layout (sidebar + breadcrumb)
6. `PlanView` — timeline des semaines
7. `WeekView` — agenda
8. `SessionView` — liste de blocs (lecture seule d'abord)
9. Composants de blocs (un par type, du plus simple au plus complexe)
10. Side drawer d'édition + formulaires

**Règle importante** : lancer `npm run dev` et vérifier chaque vue dans
le navigateur avant de passer à la suivante. Corriger les erreurs TypeScript
au fil de l'eau avec `npm run type-check`.
