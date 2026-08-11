import { newId, nowIso } from '../ids.js'

/**
 * Stockage en mémoire.
 *
 * C'est le pilote utilise quand aucune clef Supabase n'est configuree :
 * il permet de lancer le projet et la suite de tests sans base a provisionner.
 * Les données disparaissent au redemarrage du process.
 *
 * Seuls les fichiers `memory/*.model.js` touchent a `db`.
 */
export const db = {
  users: new Map(), // userId -> compte (éducateur, infirmière, directeur, famille)
  authSessions: new Map(), // sessionId -> session de connexion (un appareil)
  children: new Map(), // childId -> enfant
  attendance: new Map(), // `${childId}:${date}` -> présence du jour
  activities: new Map(), // activityId -> activité
  goals: new Map(), // goalId -> objectif pédagogique
  sessions: new Map(), // sessionId -> séance
  reports: new Map(), // reportId -> compte-rendu de séance
  medications: new Map(), // medicationId -> traitement
  administrations: new Map(), // administrationId -> prise de médicament tracée
  pushSubscriptions: new Map(), // subscriptionId -> abonnement push d'un utilisateur
  notificationReads: new Set(), // `${userId}:${notificationId}` -> notification acquittee
}

/**
 * Une présence est unique par enfant et par jour : la clé porte cette
 * contrainte, comme le fait l'index unique en base.
 */
export function attendanceKey(childId, date) {
  return `${childId}:${date}`
}

/**
 * Les modèles renvoient toujours une copie : un appelant qui modifie l'objet
 * reçu ne corrompt pas le stock. Une vraie base offre la même garantie.
 */
export function snapshot(value) {
  return value === undefined ? undefined : structuredClone(value)
}

/** Utilitaire de test : repart d'un stock vide. */
export function resetStore() {
  for (const collection of Object.values(db)) {
    collection.clear()
  }
}

export { newId, nowIso }
