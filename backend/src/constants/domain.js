/**
 * Vocabulaire metier du centre : valeur technique -> libelle affiche.
 * Les services valident contre les cles, le front recupere les libelles
 * via `GET /api/reference` et n'a donc aucune liste en dur.
 */

export const DISABILITY_TYPES = Object.freeze({
  autism: 'Trouble du spectre autistique',
  intellectual: 'Deficience intellectuelle',
  motor: 'Handicap moteur',
  visual: 'Deficience visuelle',
  hearing: 'Deficience auditive',
  language: 'Trouble du langage et des apprentissages',
  behavioral: 'Trouble du comportement',
  multiple: 'Polyhandicap',
  other: 'Autre',
})

export const CHILD_STATUSES = Object.freeze({
  active: 'Actif',
  paused: 'Accueil suspendu',
  archived: 'Archive',
})

export const GENDERS = Object.freeze({
  female: 'Fille',
  male: 'Garcon',
  other: 'Autre',
})

export const CONTACT_RELATIONSHIPS = Object.freeze({
  mother: 'Mere',
  father: 'Pere',
  guardian: 'Tuteur legal',
  grandparent: 'Grand-parent',
  sibling: 'Frere ou soeur',
  other: 'Autre',
})

export const ATTENDANCE_STATUSES = Object.freeze({
  present: 'Present',
  late: 'Retard',
  absent: 'Absence non justifiee',
  excused: 'Absence justifiee',
})

/** Statuts comptes comme une absence par le moteur d alertes. */
export const ABSENCE_STATUSES = Object.freeze(['absent', 'excused'])

export const ACTIVITY_CATEGORIES = Object.freeze({
  arts: 'Arts plastiques',
  music: 'Musique',
  sport: 'Sport adapte',
  cooking: 'Atelier cuisine',
  outing: 'Sortie',
  sensory: 'Atelier sensoriel',
  learning: 'Atelier pedagogique',
  celebration: 'Fete',
  other: 'Autre',
})

export const ALERT_RULES = Object.freeze({
  'consecutive-absences': 'Absences consecutives',
  'repeated-absences': 'Absences repetees non justifiees',
})

export const ALERT_SEVERITIES = Object.freeze({
  warning: 'A surveiller',
  critical: 'Urgent',
})

// --- Suivi pedagogique -------------------------------------------------------

export const GOAL_DOMAINS = Object.freeze({
  communication: 'Communication et langage',
  autonomy: 'Autonomie quotidienne',
  motor: 'Motricite',
  social: 'Relations sociales',
  cognitive: 'Apprentissages cognitifs',
  behavior: 'Comportement',
  school: 'Scolarite',
  other: 'Autre',
})

export const GOAL_STATUSES = Object.freeze({
  active: 'En cours',
  achieved: 'Atteint',
  paused: 'En pause',
  abandoned: 'Abandonne',
})

export const SESSION_TYPES = Object.freeze({
  individual: 'Seance individuelle',
  group: 'Atelier collectif',
  therapy: 'Seance therapeutique',
  outing: 'Sortie',
  'family-meeting': 'Rencontre famille',
  other: 'Autre',
})

export const SESSION_STATUSES = Object.freeze({
  planned: 'Planifiee',
  completed: 'Realisee',
  cancelled: 'Annulee',
})

/**
 * Humeur relevee en fin de seance. L'echelle est ordonnee : le score
 * numerique associe permet de tracer une courbe d evolution.
 */
export const MOODS = Object.freeze({
  'very-difficult': 'Tres difficile',
  difficult: 'Difficile',
  neutral: 'Neutre',
  good: 'Bon',
  'very-good': 'Tres bon',
})

export const MOOD_SCORES = Object.freeze({
  'very-difficult': 1,
  difficult: 2,
  neutral: 3,
  good: 4,
  'very-good': 5,
})

// --- Suivi medical -----------------------------------------------------------

export const MEDICATION_ROUTES = Object.freeze({
  oral: 'Voie orale',
  topical: 'Voie cutanee',
  inhaled: 'Inhalation',
  injection: 'Injection',
  other: 'Autre',
})

export const ADMINISTRATION_STATUSES = Object.freeze({
  given: 'Administre',
  refused: 'Refuse par l enfant',
  missed: 'Non administre',
})

// --- Notifications -----------------------------------------------------------

export const NOTIFICATION_TYPES = Object.freeze({
  'absence-alert': 'Absences repetees',
  'medication-reminder': 'Rappel de medicament',
  'session-reminder': 'Seance planifiee',
  'report-pending': 'Compte-rendu en attente',
  'health-alert': 'Alerte de sante',
})

/** `{ autism: 'Trouble...' }` -> `['autism']`, pour la validation. */
export const keysOf = (dictionary) => Object.keys(dictionary)

/** `{ autism: 'Trouble...' }` -> `[{ value: 'autism', label: 'Trouble...' }]`, pour les selects. */
export const toOptions = (dictionary) =>
  Object.entries(dictionary).map(([value, label]) => ({ value, label }))
