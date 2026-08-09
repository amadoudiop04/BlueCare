import { createHash, randomBytes } from 'node:crypto'

/**
 * Jetons de session opaques.
 *
 * Contrairement a un JWT, ce jeton ne porte aucune information : il ne sert
 * qu'a retrouver une ligne en base. Deux consequences qui comptent ici —
 * une session se revoque immediatement (on supprime la ligne), et un jeton
 * intercepte ne revele ni le role ni l'identifiant de l utilisateur.
 *
 * Seul le HACHAGE est stocke. Une copie de la base ne permet donc pas de
 * rejouer les sessions en cours, exactement comme pour les mots de passe.
 * SHA-256 suffit ici, sans bcrypt : le jeton fait deja 256 bits d'entropie,
 * il n y a rien a forcer par dictionnaire.
 */

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

