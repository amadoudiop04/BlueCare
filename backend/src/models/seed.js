import { randomBytes, randomUUID } from 'node:crypto'

import { activityModel } from './activity.model.js'
import { attendanceModel } from './attendance.model.js'
import { childModel } from './child.model.js'
import { goalModel } from './goal.model.js'
import { medicationModel } from './medication.model.js'
import { reportModel } from './report.model.js'
import { sessionModel } from './session.model.js'
import { userModel } from './user.model.js'
import { env } from '../config/env.js'
import { addDays, addMonths, isWeekend, today } from '../utils/dates.js'
import { hashPasswordSync } from '../utils/password.js'

/**
 * Jeu de données de démonstration.
 *
 * Il passe par les modèles, donc il alimente indifferemment le stockage en
 * mémoire ou Supabase — c'est ce qui permet de peupler une vraie base avec
 * `npm run seed`.
 *
 * Les dates sont calculees à partir du jour courant : les alertes et les
 * courbes restent visibles quelle que soit la date de lancement.
 */

/** Jours d'accueil (hors week-end) des sept dernières semaines. */
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
      details: 'Trouble du spectre autistique, communication verbale limitée.',
      recognizedAt: '2021-09-01',
      supportPlan: 'Pictogrammes PECS, temps calme après le repas.',
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
      specialty: 'Pédopsychiatrie',
      facility: 'CHU Souro Sanou',
      phone: '+226 20 97 00 00',
      email: null,
      address: null,
    },
    notes: 'Progrès nets sur les temps de groupe depuis mars.',
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
      supportPlan: 'Séances orthophonie le mardi, supports visuels en atelier.',
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
      supportPlan: 'Langue des signes, se placer face à elle pour parler.',
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
 * Comptes de démonstration, un par rôle.
 *
 * Aucun mot de passe n'est écrit ici : un identifiant en clair dans le dépôt
 * finit toujours par être essaye ailleurs, et la personne qui reprend le
 * projet n'a aucun moyen de savoir s'il a été change. Les six comptes
 * partagent celui de `SEED_PASSWORD` (`backend/.env`, hors dépôt), ou a
 * défaut un mot de passe tire au hasard a chaque amorçage, affiche une fois
 * dans la console.
 */
const USERS = [
  {
    // Compte de recette : périmètre complet, tous les écrans, toutes les
    // écritures. La double authentification n'est pas activée d'office pour
    // qu'une première connexion reste possible sans téléphone ; l'écran
    // « Mon profil » permet de l'activer et de tester le parcours complet.
    key: 'admin',
    email: 'admin@papillonbleu.test',
    role: 'admin',
    firstName: 'Compte',
    lastName: 'Administrateur',
  },
  {
    key: 'director',
    email: 'directrice@papillonbleu.test',
    role: 'director',
    firstName: 'Nadia',
    lastName: 'Compaore',
  },
  {
    key: 'nurse',
    email: 'infirmiere@papillonbleu.test',
    role: 'nurse',
    firstName: 'Sarah',
    lastName: 'Zongo',
  },
  {
    key: 'educatorCoquelicots',
    email: 'educateur.coquelicots@papillonbleu.test',
    role: 'educator',
    firstName: 'Yacouba',
    lastName: 'Sawadogo',
    groups: ['Les Coquelicots'],
  },
  {
    key: 'educatorBleuets',
    email: 'educateur.bleuets@papillonbleu.test',
    role: 'educator',
    firstName: 'Mariam',
    lastName: 'Kone',
    groups: ['Les Bleuets'],
  },
  {
    key: 'family',
    email: 'famille.bakayoko@papillonbleu.test',
    role: 'family',
    firstName: 'Aminata',
    lastName: 'Bakayoko',
    childKeys: ['lina'],
  },
]

/**
 * Mot de passe commun aux six comptes.
 *
 * `SEED_PASSWORD` s'il est renseigne — c'est le confort de qui developpe tous
 * les jours, avec un mot de passe stable d'un amorçage a l'autre. Sinon, un
 * tirage aleatoire : la valeur est rendue a l'appelant, qui l'affiche. Ainsi
 * un depot fraichement clone n'a aucun identifiant valable écrit nulle part.
 */
function demoPassword() {
  if (env.seedPassword) return { password: env.seedPassword, generated: false }

  return { password: `demo-${randomBytes(9).toString('base64url')}`, generated: true }
}

/** Objectifs suivis, avec la progression relevee séance après séance. */
const GOALS = [
  {
    childKey: 'lina',
    title: 'Formuler une demande avec un pictogramme',
    domain: 'communication',
    description: 'Utiliser le classeur PECS pour demander un objet ou une activité.',
    baseline: 'Prend la main de l\'adulte sans support visuel.',
    successCriteria: 'Trois demandes spontanées par séance, sans guidance.',
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
    description: 'Enchainer sujet, verbe et complement a l\'oral.',
    baseline: 'Mots isoles, parfois deux mots.',
    successCriteria: 'Cinq phrases de trois mots dans une séance.',
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
  {
    childKey: 'adam',
    title: 'Enchaîner les trois étapes du lavage des mains',
    domain: 'autonomy',
    description: 'Mouiller, savonner, rincer sans rappel entre les étapes.',
    baseline: 'Réalise la première étape puis s\'interrompt.',
    successCriteria: 'Les trois étapes dans l\'ordre, deux fois de suite.',
    progression: [15, 20, 30, 35, 45, 50, 60, 65, 70],
  },
  {
    childKey: 'adam',
    title: 'Trier dix images en deux catégories',
    domain: 'cognitive',
    description: 'Séparer animaux et objets du quotidien, consigne donnée une seule fois.',
    baseline: 'Trie correctement trois images sur dix.',
    successCriteria: 'Huit images sur dix, sans reformulation de la consigne.',
    progression: [20, 25, 30, 40, 45, 55, 60, 65, 75],
  },
  {
    childKey: 'elsa',
    title: 'Signer une phrase de deux signes',
    domain: 'communication',
    description: 'Associer deux signes pour formuler une demande en langue des signes.',
    baseline: 'Signe isolé, souvent répété.',
    successCriteria: 'Cinq phrases de deux signes dans une séance.',
    progression: [25, 30, 40, 45, 55, 60, 70, 75, 85],
  },
  {
    childKey: 'elsa',
    title: 'Solliciter un camarade pendant un atelier',
    domain: 'social',
    description: 'Aller vers un autre enfant pour demander un matériel, sans passer par l\'adulte.',
    baseline: 'Passe systématiquement par l\'adulte.',
    successCriteria: 'Deux sollicitations directes par atelier.',
    progression: [10, 15, 20, 30, 35, 40, 50, 55, 60],
  },
]

const MOOD_CYCLE = ['good', 'neutral', 'very-good', 'good', 'difficult', 'good', 'very-good']

/**
 * Statut de présence par enfant, selon le rang du jour depuis la fin
 * (`0` = dernier jour d'accueil). Deux situations declenchent volontairement
 * le moteur d'alertes : Malik enchaine 4 absences non justifiées, Sofia en
 * cumule 5 dispersees.
 */
const ATTENDANCE_RULES = {
  lina: (fromEnd) =>
    fromEnd === 8 ? { status: 'excused', reason: 'Rendez-vous médical' } : { status: 'present' },
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
      "Grande fresque collective sur le thème de la savane. Lina a choisi les couleurs chaudes, Malik a peint l'arbre central et Elsa a signe la fresque en langue des signes.",
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
    location: 'Cuisine pédagogique',
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
      'Découverte du djembe et du balafon. Malik a tenu le rythme sur tout le morceau, Elsa a suivi les vibrations au sol.',
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
    instructions: "En cas d'effort ou de gene respiratoire.",
  },
]

/**
 * Crée le jeu de démonstration s'il n'existe pas déjà.
 * Idempotent : relancer la commande ne duplique rien.
 */
export async function seedDemoData() {
  const existing = await childModel.findAll({})
  if (existing.length > 0) return { skipped: true, reason: 'des enfants existent déjà' }

  const childIds = new Map()
  const userIds = new Map()

  // 1. Les enfants d'abord : les comptes famille s'y rattachent.
  for (const { key, ...data } of CHILDREN) {
    const child = await childModel.create({
      ...data,
      status: 'active',
      enrolledAt: addDays(today(), -400),
    })
    childIds.set(key, child.id)
  }

  // 2. Les comptes : tout le reste référence leur identifiant. Les six
  // partagent le même mot de passe, chacun avec son propre sel.
  const { password, generated } = demoPassword()

  for (const { key, childKeys = [], groups = [], ...data } of USERS) {
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

  // 3. Présences.
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

  // 4. Objectifs, séances et comptes-rendus sur six mois.
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

    // Une séance tous les ~20 jours, la dernière il y a une semaine.
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
                ? 'Belle séance, l\'objectif se stabilise.'
                : 'Progression régulière, supports visuels maintenus.',
          },
        ],
        observations:
          'Séance menee dans le calme. L\'enfant a participé aux consignes proposées ' +
          'et a accepte les temps de transition.',
        attentionPoints: index % 4 === 0 ? ['Fatigue en fin de séance'] : [],
        nextSteps: 'Reprendre le même support la prochaine fois.',
        healthFlag: { flagged: false, description: null },
        submittedAt: new Date().toISOString(),
      })
    }
  }

  // Une séance a venir : elle alimente les rappels de séances planifiées.
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

  // 5. Activités.
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
    // Rendu a l'appelant plutôt qu'affiche ici : c'est la commande qui sait
    // ou elle ecrit. Le mot de passe n'est montre que s'il a été tire au sort,
    // celui d'un `.env` n'a pas a repasser par les journaux.
    password: generated ? password : null,
  }
}
