import { randomUUID } from 'node:crypto'

/**
 * Stockage en memoire, volontairement minimal.
 *
 * Les fichiers `*.model.js` sont les seuls a lire ou ecrire dans `db`.
 * Brancher une vraie base (Postgres, Mongo...) revient donc a reecrire ces
 * modeles : les services, controllers et routes ne bougent pas.
 *
 * A savoir : les donnees disparaissent au redemarrage du process.
 */
export const db = {
  users: new Map(), // userId -> compte (educateur, infirmiere, directeur, famille)
  children: new Map(), // childId -> enfant
  attendance: new Map(), // `${childId}:${date}` -> presence du jour
  activities: new Map(), // activityId -> activite
  goals: new Map(), // goalId -> objectif pedagogique
  sessions: new Map(), // sessionId -> seance
  reports: new Map(), // reportId -> compte-rendu de seance
  medications: new Map(), // medicationId -> traitement
  administrations: new Map(), // administrationId -> prise de medicament tracee
  pushSubscriptions: new Map(), // subscriptionId -> abonnement push d'un utilisateur
  notificationReads: new Set(), // `${userId}:${notificationId}` -> notification acquittee
}

export function newId(prefix) {
  return `${prefix}_${randomUUID()}`
}

export function nowIso() {
  return new Date().toISOString()
}

/**
 * Une presence est unique par enfant et par jour : la cle porte cette
 * contrainte, comme le ferait un index unique en base.
 */
export function attendanceKey(childId, date) {
  return `${childId}:${date}`
}

/**
 * Les modeles renvoient toujours une copie : un appelant qui modifie l'objet
 * recu ne corrompt pas le stock. Une vraie base offrirait la meme garantie.
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
