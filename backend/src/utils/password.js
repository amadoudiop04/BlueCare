import bcrypt from 'bcryptjs'

import { env } from '../config/env.js'

/**
 * Hachage des mots de passe (bcrypt).
 *
 * `bcryptjs` est l'implementation JavaScript pure de bcrypt : même algorithme
 * et mêmes empreintes que le paquet natif `bcrypt`, sans chaîne de compilation
 * a installer. Les hachages sont interchangeables entre les deux.
 */

export function hashPassword(plain) {
  return bcrypt.hash(plain, env.auth.bcryptRounds)
}

/** Variante synchrone, réservée a l'amorçage des données de démonstration. */
export function hashPasswordSync(plain) {
  return bcrypt.hashSync(plain, env.auth.bcryptRounds)
}

export function verifyPassword(plain, hash) {
  if (typeof hash !== 'string' || hash === '') return Promise.resolve(false)
  return bcrypt.compare(plain, hash)
}

/**
 * Comparaison a vide, utilisée quand l'e-mail n'existe pas.
 * Le temps de réponse reste celui d'un vrai échec, ce qui évite de reveler
 * quels comptes existent en mesurant la latence.
 */
const DUMMY_HASH = bcrypt.hashSync('bluecare-dummy-password', 10)

export function wasteTime() {
  return bcrypt.compare('bluecare-dummy-password', DUMMY_HASH)
}
