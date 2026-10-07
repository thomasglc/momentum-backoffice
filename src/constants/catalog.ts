// Listes fermées des deux catalogues : les valeurs sont celles de Directus, les libellés ceux que lit le coach.

export interface Option {
  value: string
  label: string
}

export const CATEGORIES: Option[] = [
  { value: 'lower_body', label: 'Bas du corps' },
  { value: 'upper_body', label: 'Haut du corps' },
  { value: 'posterior_chain', label: 'Chaîne postérieure' },
  { value: 'core', label: 'Gainage' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobilité' },
]

export const EQUIPMENT: Option[] = [
  { value: 'barbell', label: 'Barre' },
  { value: 'dumbbell', label: 'Haltères' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'machine', label: 'Machine' },
  { value: 'band', label: 'Élastique' },
]

export const MEASUREMENTS: Option[] = [
  { value: 'distance', label: 'Distance' },
  { value: 'reps', label: 'Répétitions' },
  { value: 'time', label: 'Temps' },
  { value: 'mixed', label: 'Mixte' },
]

/** Libellé d'une valeur ; une valeur inconnue de la liste s'affiche telle quelle */
export const labelOf = (options: Option[], value: string | null | undefined): string =>
  options.find(option => option.value === value)?.label ?? value ?? ''

/** La liste, plus la valeur en place si Directus en connaît une que la liste ignore : le formulaire ne la perd pas */
export const withCurrent = (options: Option[], value: string): Option[] =>
  !value || options.some(option => option.value === value) ? options : [...options, { value, label: value }]
