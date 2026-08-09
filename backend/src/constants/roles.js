/**
 * Roles et perimetre de chacun.
 *
 * Deux notions distinctes, volontairement separees :
 *  - le ROLE dit quelles routes sont ouvertes (`middlewares/authorize.js`)
 *  - le PERIMETRE dit sur quels enfants elles s'appliquent (`services/access.service.js`)
 *
 * Un educateur peut appeler `GET /api/children/:id` (role autorise) mais
 * recevra un 403 si l enfant n est pas dans ses groupes (perimetre).
 */

export const ROLES = Object.freeze({
  educator: 'Educateur',
  nurse: 'Infirmiere',
  director: 'Directeur',
  family: 'Famille',
  admin: 'Administrateur',
})

export const ROLE_KEYS = Object.keys(ROLES)

/**
 * Groupes de roles utilises par les routes.
 *
 * Les declarer ici plutot que d'enumerer des chaines dans chaque fichier de
 * routes evite qu un role ajoute plus tard soit oublie a un endroit : c'est
 * exactement ce qui rend une regle d acces fausse sans que rien ne le signale.
 */

/** Equipe du centre : tout le monde sauf les familles. */
export const STAFF_ROLES = Object.freeze(['educator', 'nurse', 'director', 'admin'])

/** Pilotage : tableau de bord, exports, gestion des comptes. */
export const DIRECTION_ROLES = Object.freeze(['director', 'admin'])

/** Qui saisit le suivi pedagogique (objectifs, seances, comptes-rendus). */
export const PEDAGOGY_ROLES = Object.freeze(['educator', 'director', 'admin'])

/** Qui accede aux donnees medicales (traitements, medecin referent). */
export const MEDICAL_ROLES = Object.freeze(['nurse', 'director', 'admin'])

/** Voient tous les enfants du centre, sans restriction de groupe. */
export const ROLES_WITH_FULL_SCOPE = Object.freeze(['director', 'nurse', 'admin'])

/** Peuvent consulter les donnees medicales. */
export const ROLES_WITH_MEDICAL_ACCESS = MEDICAL_ROLES

/** Lecture seule absolue : aucune ecriture, quelle que soit la ressource. */
export const READ_ONLY_ROLES = Object.freeze(['family'])

export const USER_STATUSES = Object.freeze({
  active: 'Actif',
  disabled: 'Desactive',
})
