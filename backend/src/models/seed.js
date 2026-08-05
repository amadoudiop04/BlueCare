import { randomUUID } from 'node:crypto'

import { addDays, addMonths, isWeekend, today } from '../utils/dates.js'
import { hashPasswordSync } from '../utils/password.js'
import { attendanceKey, db, newId, nowIso } from './store.js'

/**
 * Jeu de donnees de demonstration.
 *
 * Il n'existe qu'en developpement (voir `env.seedDemoData`) et sert a ouvrir
 * l'application sur des ecrans deja remplis : des fiches completes, un
 * historique de presences et deux situations qui declenchent des alertes.
 *
 * Les dates sont calculees a partir du jour courant : les alertes restent
 * visibles quelle que soit la date a laquelle on lance le projet.
 */

/** Jours d'accueil (hors week-end) des sept dernieres semaines, du plus ancien au plus recent. */
function openingDays(count = 35) {
  const days = []

  for (let offset = count; offset >= 1; offset -= 1) {
    const date = addDays(today(), -offset)
    if (!isWeekend(date)) days.push(date)
  }

  return days
}

const contact = (data) => ({
  id: randomUUID(),
  firstName: null,
  email: null,
  address: null,
  notes: null,
  isPrimary: false,
  ...data,
})

const CHILDREN = [
  {
    key: 'lina',
    firstName: 'Lina',
    lastName: 'Bakayoko',
    birthDate: '2017-04-12',
    gender: 'female',
    group: 'Les Coquelicots',
    address: '12 rue des Lilas, Bobo-Dioulasso',
    disability: {
      type: 'autism',
      details: "Trouble du spectre autistique, communication verbale limitee.",
      recognizedAt: '2021-09-01',
      supportPlan: 'Pictogrammes PECS, temps calme apres le repas.',
    },
    familyContacts: [
      contact({
        firstName: 'Aminata',
        lastName: 'Bakayoko',
        relationship: 'mother',
        phone: '+226 70 11 22 33',
        email: 'aminata.bakayoko@example.org',
        isPrimary: true,
      }),
      contact({ firstName: 'Ibrahim', lastName: 'Bakayoko', relationship: 'father', phone: '+226 70 44 55 66' }),
    ],
    referringDoctor: {
      firstName: 'Claire',
      lastName: 'Dupont',
      specialty: 'Pedopsychiatrie',
      facility: 'CHU Souro Sanou',
      phone: '+226 20 97 00 00',
      email: null,
      address: null,
    },
    notes: 'Progres nets sur les temps de groupe depuis mars.',
  },
  {
    key: 'malik',
    firstName: 'Malik',
    lastName: 'Ferrand',
    birthDate: '2016-11-03',
    gender: 'male',
    group: 'Les Coquelicots',
    address: '3 avenue de la Liberte, Bobo-Dioulasso',
    disability: {
      type: 'language',
      details: 'Dysphasie expressive, suivi orthophonique hebdomadaire.',
      recognizedAt: '2022-01-15',
      supportPlan: 'Seances orthophonie le mardi, supports visuels en atelier.',
    },
    familyContacts: [
      contact({
        firstName: 'Sylvie',
        lastName: 'Ferrand',
        relationship: 'mother',
        phone: '+226 71 23 45 67',
        email: 'sylvie.ferrand@example.org',
        isPrimary: true,
      }),
    ],
    referringDoctor: {
      firstName: 'Marc',
      lastName: 'Ouedraogo',
      specialty: 'Pediatrie',
      facility: 'Cabinet du Centre',
      phone: '+226 20 98 11 11',
      email: null,
      address: null,
    },
    notes: null,
  },
  {
    key: 'sofia',
    firstName: 'Sofia',
    lastName: 'Nguyen',
    birthDate: '2018-02-27',
    gender: 'female',
    group: 'Les Bleuets',
    address: '7 rue du Marche, Bobo-Dioulasso',
    disability: {
      type: 'motor',
      details: 'Paralysie cerebrale, deplacement en fauteuil.',
      recognizedAt: '2019-06-10',
      supportPlan: 'Kinesitherapie deux fois par semaine, transferts a deux adultes.',
    },
    familyContacts: [
      contact({
        firstName: 'Thi Lan',
        lastName: 'Nguyen',
        relationship: 'mother',
        phone: '+226 72 33 44 55',
        isPrimary: true,
      }),
      contact({ firstName: 'Helene', lastName: 'Nguyen', relationship: 'grandparent', phone: '+226 72 99 88 77' }),
    ],
    referringDoctor: {
      firstName: 'Awa',
      lastName: 'Sanou',
      specialty: 'Medecine physique et readaptation',
      facility: 'CHU Souro Sanou',
      phone: '+226 20 97 22 22',
      email: null,
      address: null,
    },
    notes: 'Transport assure par la famille, arrivees parfois decalees.',
  },
  {
    key: 'adam',
    firstName: 'Adam',
    lastName: 'Traore',
    birthDate: '2015-08-19',
    gender: 'male',
    group: 'Les Bleuets',
    address: '21 secteur 9, Bobo-Dioulasso',
    disability: {
      type: 'intellectual',
      details: 'Deficience intellectuelle moderee.',
      recognizedAt: '2020-03-05',
      supportPlan: 'Consignes courtes, une tache a la fois.',
    },
    familyContacts: [
      contact({
        firstName: 'Fatou',
        lastName: 'Traore',
        relationship: 'guardian',
        phone: '+226 73 12 34 56',
        email: 'fatou.traore@example.org',
        isPrimary: true,
      }),
    ],
    referringDoctor: null,
    notes: null,
  },
  {
    key: 'elsa',
    firstName: 'Elsa',
    lastName: 'Moreau',
    birthDate: '2017-12-08',
    gender: 'female',
    group: 'Les Coquelicots',
    address: '5 rue des Manguiers, Bobo-Dioulasso',
    disability: {
      type: 'hearing',
      details: 'Surdite bilaterale appareillee.',
      recognizedAt: '2018-11-20',
      supportPlan: 'Langue des signes, se placer face a elle pour parler.',
    },
    familyContacts: [
      contact({
        firstName: 'Julien',
        lastName: 'Moreau',
        relationship: 'father',
        phone: '+226 74 55 66 77',
        isPrimary: true,
      }),
    ],
    referringDoctor: {
      firstName: 'Paul',
      lastName: 'Kabore',
      specialty: 'ORL',
      facility: 'Clinique Sainte-Marie',
      phone: '+226 20 96 33 33',
      email: null,
      address: null,
    },
    notes: null,
  },
]

/**
 * Statut de presence par enfant, en fonction du rang du jour depuis la fin
 * (`0` = dernier jour d'accueil). Deux situations sont volontairement
 * construites pour declencher le moteur d'alertes :
 *  - Malik enchaine 4 absences non justifiees -> absences consecutives + repetees
 *  - Sofia cumule 5 absences non justifiees dispersees -> absences repetees
 */
const ATTENDANCE_RULES = {
  lina: (fromEnd) => (fromEnd === 8 ? { status: 'excused', reason: 'Rendez-vous medical' } : { status: 'present' }),
  malik: (fromEnd) =>
    fromEnd < 4 ? { status: 'absent' } : { status: 'present' },
  sofia: (fromEnd) =>
    [1, 4, 7, 11, 15].includes(fromEnd) ? { status: 'absent' } : { status: 'present' },
  adam: (fromEnd) =>
    [3, 4].includes(fromEnd) ? { status: 'excused', reason: 'Varicelle' } : { status: 'present' },
  elsa: (fromEnd) =>
    [2, 6].includes(fromEnd)
      ? { status: 'late', arrivalTime: '09:35', reason: null }
      : { status: 'present' },
}

const ACTIVITIES = [
  {
    dayOffset: 3,
    title: 'Atelier peinture aux doigts',
    category: 'arts',
    group: 'Les Coquelicots',
    location: 'Salle bleue',
    description:
      "Grande fresque collective sur le theme de la savane. Lina a choisi les couleurs chaudes, Malik a peint l'arbre central et Elsa a signe la fresque en langue des signes.",
    participants: ['lina', 'malik', 'elsa'],
    media: [
      { url: '/media/2026/fresque-savane-1.jpg', caption: 'La fresque terminee' },
      { url: '/media/2026/fresque-savane-2.jpg', caption: 'Malik devant son arbre' },
    ],
  },
  {
    dayOffset: 9,
    title: 'Sortie au jardin botanique',
    category: 'outing',
    group: 'Les Bleuets',
    location: 'Jardin botanique municipal',
    description:
      'Parcours sensoriel adapte. Sofia a mene le groupe sur le chemin accessible et Adam a reconnu six plantes sur huit.',
    participants: ['sofia', 'adam'],
    media: [{ url: '/media/2026/jardin-botanique.jpg', caption: 'Pause sous le manguier' }],
  },
  {
    dayOffset: 16,
    title: 'Atelier cuisine : galettes de mil',
    category: 'cooking',
    group: null,
    location: 'Cuisine pedagogique',
    description:
      "Preparation en binomes. Adam a dose la farine, Lina a petri la pate, Sofia a decore les galettes et Elsa a mis la table.",
    participants: ['lina', 'sofia', 'adam', 'elsa'],
    media: [
      { url: '/media/2026/galettes-mil-1.jpg', caption: 'Le petrissage' },
      { url: '/media/2026/galettes-mil-2.jpg', caption: 'Lina et Adam au four' },
    ],
  },
  {
    dayOffset: 24,
    title: 'Eveil musical aux percussions',
    category: 'music',
    group: 'Les Coquelicots',
    location: 'Salle de motricite',
    description:
      'Decouverte du djembe et du balafon. Malik a tenu le rythme sur tout le morceau, Elsa a suivi les vibrations au sol.',
    participants: ['malik', 'elsa'],
    media: [{ url: '/media/2026/eveil-musical.jpg', caption: 'Cercle de percussions' }],
  },
]

/**
 * Comptes de demonstration, un par role.
 * Mots de passe en clair ici parce qu'ils ne servent qu'en developpement :
 * `SEED_DEMO_DATA=false` ou `NODE_ENV=production` empeche leur creation.
 */
const USERS = [
  {
    key: 'director',
    email: 'directrice@papillonbleu.test',
    password: 'Directrice2026!',
    role: 'director',
    firstName: 'Nadia',
    lastName: 'Compaore',
  },
  {
    key: 'nurse',
    email: 'infirmiere@papillonbleu.test',
    password: 'Infirmiere2026!',
    role: 'nurse',
    firstName: 'Sarah',
    lastName: 'Zongo',
  },
  {
    key: 'educatorCoquelicots',
    email: 'educateur.coquelicots@papillonbleu.test',
    password: 'Educateur2026!',
    role: 'educator',
    firstName: 'Yacouba',
    lastName: 'Sawadogo',
    groups: ['Les Coquelicots'],
  },
  {
    key: 'educatorBleuets',
    email: 'educateur.bleuets@papillonbleu.test',
    password: 'Educateur2026!',
    role: 'educator',
    firstName: 'Mariam',
    lastName: 'Kone',
    groups: ['Les Bleuets'],
  },
  {
    key: 'family',
    email: 'famille.bakayoko@papillonbleu.test',
    password: 'Famille2026!',
    role: 'family',
    firstName: 'Aminata',
    lastName: 'Bakayoko',
    childKeys: ['lina'],
  },
]

/** Objectifs suivis, avec la progression relevee seance apres seance. */
const GOALS = [
  {
    key: 'lina-communication',
    childKey: 'lina',
    title: 'Formuler une demande avec un pictogramme',
    domain: 'communication',
    description: "Utiliser le classeur PECS pour demander un objet ou une activite.",
    baseline: 'Prend la main de l adulte sans support visuel.',
    successCriteria: 'Trois demandes spontanees par seance, sans guidance.',
    progression: [15, 25, 30, 40, 45, 55, 60, 70, 75],
  },
  {
    key: 'lina-social',
    childKey: 'lina',
    title: 'Rester en atelier collectif dix minutes',
    domain: 'social',
    description: 'Participer a un atelier de groupe sans quitter la table.',
    baseline: 'Quitte la table au bout de deux minutes.',
    successCriteria: 'Dix minutes assise, avec un rappel maximum.',
    progression: [10, 20, 25, 35, 40, 50, 55, 60, 65],
  },
  {
    key: 'malik-language',
    childKey: 'malik',
    title: 'Produire des phrases de trois mots',
    domain: 'communication',
    description: 'Enchainer sujet, verbe et complement a l oral.',
    baseline: 'Mots isoles, parfois deux mots.',
    successCriteria: 'Cinq phrases de trois mots dans une seance.',
    progression: [20, 30, 35, 45, 50, 55, 65, 70, 80],
  },
  {
    key: 'sofia-autonomy',
    childKey: 'sofia',
    title: 'Realiser seule les transferts fauteuil / table',
    domain: 'autonomy',
    description: 'Transfert avec planche, sans aide physique.',
    baseline: 'Transfert avec deux adultes.',
    successCriteria: 'Transfert avec supervision seule.',
    progression: [10, 15, 25, 30, 35, 45, 50, 55, 60],
  },
]

const MOOD_CYCLE = ['good', 'neutral', 'very-good', 'good', 'difficult', 'good', 'very-good']

const MEDICATIONS = [
  {
    childKey: 'sofia',
    name: 'Baclofene',
    dosage: '10 mg',
    route: 'oral',
    schedule: { times: ['12:00'], days: [1, 2, 3, 4, 5] },
    prescribedBy: 'Dr Awa Sanou',
    instructions: 'A donner pendant le repas.',
  },
  {
    childKey: 'adam',
    name: 'Ventoline',
    dosage: '2 bouffees',
    route: 'inhaled',
    schedule: { times: ['08:30', '16:00'], days: [] },
    prescribedBy: 'Dr Marc Ouedraogo',
    instructions: "En cas d'effort ou de gene respiratoire.",
  },
]

export function seedDemoData() {
  // Idempotent : appeler `createApp()` plusieurs fois ne duplique pas les donnees.
  if (db.children.size > 0) return { skipped: true }

  const timestamp = nowIso()
  const idsByKey = new Map()

  for (const { key, ...data } of CHILDREN) {
    const child = {
      id: newId('chd'),
      ...data,
      status: 'active',
      enrolledAt: addDays(today(), -400),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    idsByKey.set(key, child.id)
    db.children.set(child.id, child)
  }

  const days = openingDays()

  for (const [key, rule] of Object.entries(ATTENDANCE_RULES)) {
    const childId = idsByKey.get(key)

    days.forEach((date, index) => {
      const fromEnd = days.length - 1 - index
      const { status, reason = null, arrivalTime = null } = rule(fromEnd)

      const record = {
        id: newId('att'),
        childId,
        date,
        status,
        arrivalTime: arrivalTime ?? (status === 'present' ? '08:45' : null),
        departureTime: status === 'present' || status === 'late' ? '16:30' : null,
        reason,
        notes: null,
        recordedBy: 'Educateur referent',
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      db.attendance.set(attendanceKey(childId, date), record)
    })
  }

  for (const activity of ACTIVITIES) {
    const id = newId('act')

    db.activities.set(id, {
      id,
      title: activity.title,
      description: activity.description,
      category: activity.category,
      date: addDays(today(), -activity.dayOffset),
      group: activity.group,
      location: activity.location,
      participantIds: activity.participants.map((key) => idsByKey.get(key)),
      media: activity.media.map((item) => ({ id: randomUUID(), ...item })),
      createdBy: 'Educateur referent',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  const userIdsByKey = seedUsers(idsByKey, timestamp)
  seedPedagogy(idsByKey, userIdsByKey, timestamp)
  seedMedications(idsByKey, userIdsByKey, timestamp)

  return {
    skipped: false,
    users: db.users.size,
    children: db.children.size,
    attendance: db.attendance.size,
    activities: db.activities.size,
    goals: db.goals.size,
    sessions: db.sessions.size,
    reports: db.reports.size,
    medications: db.medications.size,
  }
}

/** Comptes de demonstration. Exporte a part pour que les tests s'en servent seuls. */
export function seedUsers(childIdsByKey = new Map(), timestamp = nowIso()) {
  const userIdsByKey = new Map()

  for (const { key, password, childKeys = [], ...data } of USERS) {
    const user = {
      id: newId('usr'),
      ...data,
      groups: data.groups ?? [],
      childIds: childKeys.map((childKey) => childIdsByKey.get(childKey)).filter(Boolean),
      passwordHash: hashPasswordSync(password),
      status: 'active',
      phone: null,
      lastLoginAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    userIdsByKey.set(key, user.id)
    db.users.set(user.id, user)
  }

  return userIdsByKey
}

/**
 * Objectifs, seances et comptes-rendus sur six mois.
 * Une seance toutes les trois semaines environ, avec un taux d'avancement qui
 * monte : les courbes d'evolution ont ainsi de quoi se tracer des le demarrage.
 */
function seedPedagogy(childIdsByKey, userIdsByKey, timestamp) {
  const educatorFor = (childKey) =>
    ['sofia', 'adam'].includes(childKey)
      ? userIdsByKey.get('educatorBleuets')
      : userIdsByKey.get('educatorCoquelicots')

  const start = addMonths(today(), -6)

  for (const goalSpec of GOALS) {
    const childId = childIdsByKey.get(goalSpec.childKey)
    const educatorId = educatorFor(goalSpec.childKey)
    const { progression, childKey, key, ...goalData } = goalSpec

    const goalId = newId('goa')
    const currentProgress = progression.at(-1)

    db.goals.set(goalId, {
      id: goalId,
      childId,
      ...goalData,
      startDate: start,
      targetDate: addMonths(today(), 3),
      status: currentProgress >= 100 ? 'achieved' : 'active',
      progress: currentProgress,
      achievedAt: null,
      createdBy: userIdsByKey.get('director'),
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    // Une seance tous les ~20 jours, la derniere il y a une semaine.
    progression.forEach((progress, index) => {
      const date = addDays(today(), -(progression.length - index) * 20 + 13)
      if (date > today()) return

      const sessionId = newId('ses')

      db.sessions.set(sessionId, {
        id: sessionId,
        childId,
        educatorId,
        title: goalData.title,
        date,
        startTime: '10:00',
        endTime: '10:45',
        type: index % 3 === 0 ? 'group' : 'individual',
        location: 'Salle bleue',
        notes: null,
        goalIds: [goalId],
        status: 'completed',
        createdBy: educatorId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      const reportId = newId('rep')

      db.reports.set(reportId, {
        id: reportId,
        sessionId,
        childId,
        date,
        authorId: educatorId,
        mood: MOOD_CYCLE[index % MOOD_CYCLE.length],
        moodComment: null,
        goalProgress: [
          {
            goalId,
            progress,
            worked: true,
            comment:
              index === progression.length - 1
                ? 'Belle seance, l objectif se stabilise.'
                : 'Progression reguliere, supports visuels maintenus.',
          },
        ],
        observations:
          'Seance menee dans le calme. L enfant a participe aux consignes proposees ' +
          'et a accepte les temps de transition.',
        attentionPoints: index % 4 === 0 ? ['Fatigue en fin de seance'] : [],
        nextSteps: 'Reprendre le meme support la prochaine fois.',
        healthFlag: { flagged: false, description: null },
        submittedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    })
  }

  // Une seance a venir : elle alimente les rappels de seances planifiees.
  const linaId = childIdsByKey.get('lina')
  const plannedId = newId('ses')

  db.sessions.set(plannedId, {
    id: plannedId,
    childId: linaId,
    educatorId: userIdsByKey.get('educatorCoquelicots'),
    title: 'Atelier communication',
    date: addDays(today(), 1),
    startTime: '09:30',
    endTime: '10:15',
    type: 'individual',
    location: 'Salle bleue',
    notes: null,
    goalIds: [],
    status: 'planned',
    createdBy: userIdsByKey.get('educatorCoquelicots'),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

function seedMedications(childIdsByKey, userIdsByKey, timestamp) {
  for (const { childKey, ...data } of MEDICATIONS) {
    const id = newId('med')

    db.medications.set(id, {
      id,
      childId: childIdsByKey.get(childKey),
      ...data,
      startDate: addDays(today(), -60),
      endDate: null,
      active: true,
      createdBy: userIdsByKey.get('nurse'),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }
}
