import { randomUUID } from 'node:crypto'

import { activityModel } from './activity.model.js'
import { attendanceModel } from './attendance.model.js'
import { childModel } from './child.model.js'
import { goalModel } from './goal.model.js'
import { medicationModel } from './medication.model.js'
import { reportModel } from './report.model.js'
import { sessionModel } from './session.model.js'
import { userModel } from './user.model.js'
import { addDays, addMonths, isWeekend, today } from '../utils/dates.js'
import { hashPasswordSync } from '../utils/password.js'

/**
 * Jeu de donnees de demonstration.
 *
 * Il passe par les modeles, donc il alimente indifferemment le stockage en
 * memoire ou Supabase — c est ce qui permet de peupler une vraie base avec
 * `npm run seed`.
 *
 * Les dates sont calculees a partir du jour courant : les alertes et les
 * courbes restent visibles quelle que soit la date de lancement.
 */

/** Jours d accueil (hors week-end) des sept dernieres semaines. */
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
      details: 'Trouble du spectre autistique, communication verbale limitee.',
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
 * Comptes de demonstration, un par role.
 * Mots de passe en clair ici parce qu'ils ne servent qu'en developpement :
 * `SEED_DEMO_DATA=false` ou `NODE_ENV=production` empeche leur creation.
 */
const USERS = [
  {
    // Compte de recette : perimetre complet, tous les ecrans, toutes les
    // ecritures. La double authentification n est pas activee d'office pour
    // qu une premiere connexion reste possible sans telephone ; l ecran
    // « Mon profil » permet de l'activer et de tester le parcours complet.
    key: 'admin',
    email: 'admin@papillonbleu.test',
    password: 'Admin2026!Test',
    role: 'admin',
    firstName: 'Compte',
    lastName: 'Administrateur',
  },
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
    childKey: 'lina',
    title: 'Formuler une demande avec un pictogramme',
    domain: 'communication',
    description: 'Utiliser le classeur PECS pour demander un objet ou une activite.',
    baseline: 'Prend la main de l adulte sans support visuel.',
    successCriteria: 'Trois demandes spontanees par seance, sans guidance.',
    progression: [15, 25, 30, 40, 45, 55, 60, 70, 75],
  },
  {
    childKey: 'lina',
    title: 'Rester en atelier collectif dix minutes',
    domain: 'social',
    description: 'Participer a un atelier de groupe sans quitter la table.',
    baseline: 'Quitte la table au bout de deux minutes.',
    successCriteria: 'Dix minutes assise, avec un rappel maximum.',
    progression: [10, 20, 25, 35, 40, 50, 55, 60, 65],
  },
  {
    childKey: 'malik',
    title: 'Produire des phrases de trois mots',
    domain: 'communication',
    description: 'Enchainer sujet, verbe et complement a l oral.',
    baseline: 'Mots isoles, parfois deux mots.',
    successCriteria: 'Cinq phrases de trois mots dans une seance.',
    progression: [20, 30, 35, 45, 50, 55, 65, 70, 80],
  },
  {
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

/**
 * Statut de presence par enfant, selon le rang du jour depuis la fin
 * (`0` = dernier jour d accueil). Deux situations declenchent volontairement
 * le moteur d alertes : Malik enchaine 4 absences non justifiees, Sofia en
 * cumule 5 dispersees.
 */
const ATTENDANCE_RULES = {
  lina: (fromEnd) =>
    fromEnd === 8 ? { status: 'excused', reason: 'Rendez-vous medical' } : { status: 'present' },
  malik: (fromEnd) => (fromEnd < 4 ? { status: 'absent' } : { status: 'present' }),
  sofia: (fromEnd) =>
    [1, 4, 7, 11, 15].includes(fromEnd) ? { status: 'absent' } : { status: 'present' },
  adam: (fromEnd) =>
    [3, 4].includes(fromEnd) ? { status: 'excused', reason: 'Varicelle' } : { status: 'present' },
  elsa: (fromEnd) =>
    [2, 6].includes(fromEnd)
      ? { status: 'late', arrivalTime: '09:35' }
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
      "Grande fresque collective sur le theme de la savane. Lina a choisi les couleurs chaudes, Malik a peint l arbre central et Elsa a signe la fresque en langue des signes.",
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
      'Preparation en binomes. Adam a dose la farine, Lina a petri la pate, Sofia a decore les galettes et Elsa a mis la table.',
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
    instructions: "En cas d effort ou de gene respiratoire.",
  },
]

/**
 * Cree le jeu de demonstration s il n'existe pas deja.
 * Idempotent : relancer la commande ne duplique rien.
 */
export async function seedDemoData() {
  const existing = await childModel.findAll({})
  if (existing.length > 0) return { skipped: true, reason: 'des enfants existent deja' }

  const childIds = new Map()
  const userIds = new Map()

  // 1. Les enfants d'abord : les comptes famille s y rattachent.
  for (const { key, ...data } of CHILDREN) {
    const child = await childModel.create({
      ...data,
      status: 'active',
      enrolledAt: addDays(today(), -400),
    })
    childIds.set(key, child.id)
  }

  // 2. Les comptes : tout le reste reference leur identifiant.
  for (const { key, password, childKeys = [], groups = [], ...data } of USERS) {
    const user = await userModel.create({
      ...data,
      groups,
      childIds: childKeys.map((childKey) => childIds.get(childKey)).filter(Boolean),
      passwordHash: hashPasswordSync(password),
      status: 'active',
      phone: null,
    })
    userIds.set(key, user.id)
  }

  const educatorFor = (childKey) =>
    ['sofia', 'adam'].includes(childKey)
      ? userIds.get('educatorBleuets')
      : userIds.get('educatorCoquelicots')

  // 3. Presences.
  const days = openingDays()

  for (const [childKey, rule] of Object.entries(ATTENDANCE_RULES)) {
    const childId = childIds.get(childKey)

    for (const [index, date] of days.entries()) {
      const fromEnd = days.length - 1 - index
      const { status, reason = null, arrivalTime = null } = rule(fromEnd)

      await attendanceModel.upsert({
        childId,
        date,
        status,
        arrivalTime: arrivalTime ?? (status === 'present' ? '08:45' : null),
        departureTime: status === 'present' || status === 'late' ? '16:30' : null,
        reason,
        notes: null,
        recordedBy: educatorFor(childKey),
      })
    }
  }

  // 4. Objectifs, seances et comptes-rendus sur six mois.
  const start = addMonths(today(), -6)

  for (const { childKey, progression, ...goalData } of GOALS) {
    const childId = childIds.get(childKey)
    const educatorId = educatorFor(childKey)

    const goal = await goalModel.create({
      childId,
      ...goalData,
      startDate: start,
      targetDate: addMonths(today(), 3),
      status: 'active',
      progress: progression.at(-1),
      achievedAt: null,
      createdBy: userIds.get('director'),
    })

    // Une seance tous les ~20 jours, la derniere il y a une semaine.
    for (const [index, progress] of progression.entries()) {
      const date = addDays(today(), -(progression.length - index) * 20 + 13)
      if (date > today()) continue

      const session = await sessionModel.create({
        childId,
        educatorId,
        title: goalData.title,
        date,
        startTime: '10:00',
        endTime: '10:45',
        type: index % 3 === 0 ? 'group' : 'individual',
        location: 'Salle bleue',
        notes: null,
        goalIds: [goal.id],
        status: 'completed',
        cancelReason: null,
        createdBy: educatorId,
      })

      await reportModel.create({
        sessionId: session.id,
        childId,
        date,
        authorId: educatorId,
        mood: MOOD_CYCLE[index % MOOD_CYCLE.length],
        moodComment: null,
        goalProgress: [
          {
            goalId: goal.id,
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
        submittedAt: new Date().toISOString(),
      })
    }
  }

  // Une seance a venir : elle alimente les rappels de seances planifiees.
  await sessionModel.create({
    childId: childIds.get('lina'),
    educatorId: userIds.get('educatorCoquelicots'),
    title: 'Atelier communication',
    date: addDays(today(), 1),
    startTime: '09:30',
    endTime: '10:15',
    type: 'individual',
    location: 'Salle bleue',
    notes: null,
    goalIds: [],
    status: 'planned',
    cancelReason: null,
    createdBy: userIds.get('educatorCoquelicots'),
  })

  // 5. Activites.
  for (const activity of ACTIVITIES) {
    await activityModel.create({
      title: activity.title,
      description: activity.description,
      category: activity.category,
      date: addDays(today(), -activity.dayOffset),
      group: activity.group,
      location: activity.location,
      participantIds: activity.participants.map((key) => childIds.get(key)),
      media: activity.media.map((item) => ({ id: randomUUID(), ...item })),
      createdBy: userIds.get('educatorCoquelicots'),
    })
  }

  // 6. Traitements.
  for (const { childKey, ...data } of MEDICATIONS) {
    await medicationModel.create({
      childId: childIds.get(childKey),
      ...data,
      startDate: addDays(today(), -60),
      endDate: null,
      active: true,
      createdBy: userIds.get('nurse'),
    })
  }

  return {
    skipped: false,
    children: childIds.size,
    users: userIds.size,
    days: days.length,
  }
}
