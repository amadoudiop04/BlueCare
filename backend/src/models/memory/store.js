import { newId, nowIso } from '../ids.js'

/**
 * Stockage en memoire.
 *
 * C est le pilote utilise quand aucune clef Supabase n'est configuree :
 * il permet de lancer le projet et la suite de tests sans base a provisionner.
 * Les donnees disparaissent au redemarrage du process.
 *
 * Seuls les fichiers `memory/*.model.js` touchent a `db`.
 */
export const db = {
  users: new Map(), // userId -> compte (educateur, infirmiere, directeur, famille)
  authSessions: new Map(), // sessionId -> session de connexion (un appareil)
  children: new Map(), // childId -> enfant
  attendance: new Map(), // `${childId}:${date}` -> presence du jour
  activities: new Map(), // activityId -> activite
  goals: new Map(), // goalId -> objectif pedagogique
  sessions: new Map(), // sessionId -> seance
  reports: new Map(), // reportId -> compte-rendu de seance
  medications: new Map(), // medicationId -> traitement
  administrations: new Map(), // administrationId -> prise de medicament tracee
  pushSubscriptions: new Map(), // subscriptionId -> abonnement push d un utilisateur
  notificationReads: new Set(), // `${userId}:${notificationId}` -> notification acquittee
}

/**
 * Une presence est unique par enfant et par jour : la cle porte cette
 * contrainte, comme le fait l index unique en base.
 */
export function attendanceKey(childId, date) {
  return `${childId}:${date}`
}

/**
 * Les modeles renvoient toujours une copie : un appelant qui modifie l'objet
 * recu ne corrompt pas le stock. Une vraie base offre la meme garantie.
 */
export function snapshot(value) {
  return value === undefined ? undefined : structuredClone(value)
}

/** Utilitaire de test : repart d un stock vide. */
export function resetStore() {
  for (const collection of Object.values(db)) {
    collection.clear()
  }
}

export { newId, nowIso }
