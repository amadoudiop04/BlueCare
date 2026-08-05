/**
 * Roles et perimetre de chacun.
 *
 * Deux notions distinctes, volontairement separees :
 *  - le ROLE dit quelles routes sont ouvertes (`middlewares/authorize.js`)
 *  - le PERIMETRE dit sur quels enfants elles s'appliquent (`services/access.service.js`)
 *
 * Un educateur peut appeler `GET /api/children/:id` (role autorise) mais
 * recevra un 403 si l'enfant n'est pas dans ses groupes (perimetre).
 */

export const ROLES = Object.freeze({
  educator: 'Educateur',
  nurse: 'Infirmiere',
  director: 'Directeur',
  family: 'Famille',
})

export const ROLE_KEYS = Object.keys(ROLES)

/** Voient tous les enfants du centre, sans restriction de groupe. */
export const ROLES_WITH_FULL_SCOPE = Object.freeze(['director', 'nurse'])

/** Peuvent consulter les donnees medicales (medecin referent, traitements). */
export const ROLES_WITH_MEDICAL_ACCESS = Object.freeze(['nurse', 'director'])

/** Lecture seule absolue : aucune ecriture, quelle que soit la ressource. */
export const READ_ONLY_ROLES = Object.freeze(['family'])

export const USER_STATUSES = Object.freeze({
  active: 'Actif',
  disabled: 'Desactive',
})
