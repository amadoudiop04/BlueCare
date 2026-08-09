/**
 * Vocabulaire metier du centre : valeur technique -> libelle affiche.
 * Les services valident contre les clés, le front récupère les libelles
 * via `GET /api/reference` et n'a donc aucune liste en dur.
 */

export const DISABILITY_TYPES = Object.freeze({
  autism: 'Trouble du spectre autistique',
  intellectual: 'Déficience intellectuelle',
  motor: 'Handicap moteur',
  visual: 'Déficience visuelle',
  hearing: 'Déficience auditive',
  language: 'Trouble du langage et des apprentissages',
  behavioral: 'Trouble du comportement',
  multiple: 'Polyhandicap',
  other: 'Autre',
})

export const CHILD_STATUSES = Object.freeze({
  active: 'Actif',
  paused: 'Accueil suspendu',
  archived: 'Archivé',
})

export const GENDERS = Object.freeze({
  female: 'Fille',
  male: 'Garçon',
  other: 'Autre',
})

export const CONTACT_RELATIONSHIPS = Object.freeze({
  mother: 'Mère',
  father: 'Père',
  guardian: 'Tuteur légal',
  grandparent: 'Grand-parent',
  sibling: 'Frère ou sœur',
  other: 'Autre',
})

export const ATTENDANCE_STATUSES = Object.freeze({
  present: 'Présent',
  late: 'Retard',
  absent: 'Absence non justifiée',
  excused: 'Absence justifiée',
})

/** Statuts comptes comme une absence par le moteur d'alertes. */
export const ABSENCE_STATUSES = Object.freeze(['absent', 'excused'])

export const ACTIVITY_CATEGORIES = Object.freeze({
  arts: 'Arts plastiques',
  music: 'Musique',
  sport: 'Sport adapté',
  cooking: 'Atelier cuisine',
  outing: 'Sortie',
  sensory: 'Atelier sensoriel',
  learning: 'Atelier pédagogique',
  celebration: 'Fête',
  other: 'Autre',
})

export const ALERT_RULES = Object.freeze({
  'consecutive-absences': 'Absences consécutives',
  'repeated-absences': 'Absences répétées non justifiées',
})

export const ALERT_SEVERITIES = Object.freeze({
  warning: 'À surveiller',
  critical: 'Urgent',
})

// --- Suivi pédagogique -------------------------------------------------------

export const GOAL_DOMAINS = Object.freeze({
  communication: 'Communication et langage',
  autonomy: 'Autonomie quotidienne',
  motor: 'Motricité',
  social: 'Relations sociales',
  cognitive: 'Apprentissages cognitifs',
  behavior: 'Comportement',
  school: 'Scolarité',
  other: 'Autre',
})

export const GOAL_STATUSES = Object.freeze({
  active: 'En cours',
  achieved: 'Atteint',
  paused: 'En pause',
  abandoned: 'Abandonné',
})

export const SESSION_TYPES = Object.freeze({
  individual: 'Séance individuelle',
  group: 'Atelier collectif',
  therapy: 'Séance thérapeutique',
  outing: 'Sortie',
  'family-meeting': 'Rencontre famille',
  other: 'Autre',
})

export const SESSION_STATUSES = Object.freeze({
  planned: 'Planifiée',
  completed: 'Réalisée',
  cancelled: 'Annulée',
})

/**
 * Humeur relevee en fin de séance. L'echelle est ordonnee : le score
 * numérique associe permet de tracer une courbe d'évolution.
 */
export const MOODS = Object.freeze({
  'very-difficult': 'Très difficile',
  difficult: 'Difficile',
  neutral: 'Neutre',
  good: 'Bon',
  'very-good': 'Très bon',
})

export const MOOD_SCORES = Object.freeze({
  'very-difficult': 1,
  difficult: 2,
  neutral: 3,
  good: 4,
  'very-good': 5,
})

// --- Suivi médical -----------------------------------------------------------

export const MEDICATION_ROUTES = Object.freeze({
  oral: 'Voie orale',
  topical: 'Voie cutanée',
  inhaled: 'Inhalation',
  injection: 'Injection',
  other: 'Autre',
})

export const ADMINISTRATION_STATUSES = Object.freeze({
  given: 'Administré',
  refused: "Refusé par l'enfant",
  missed: 'Non administré',
})

// --- Notifications -----------------------------------------------------------

export const NOTIFICATION_TYPES = Object.freeze({
  'absence-alert': 'Absences répétées',
  'medication-reminder': 'Rappel de médicament',
  'session-reminder': 'Séance planifiée',
  'report-pending': 'Compte-rendu en attente',
  'health-alert': 'Alerte de santé',
})

/** `{ autism: 'Trouble...' }` -> `['autism']`, pour la validation. */
export const keysOf = (dictionary) => Object.keys(dictionary)

/** `{ autism: 'Trouble...' }` -> `[{ value: 'autism', label: 'Trouble...' }]`, pour les selects. */
export const toOptions = (dictionary) =>
  Object.entries(dictionary).map(([value, label]) => ({ value, label }))
