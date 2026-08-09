/**
 * Rôles et périmètre de chacun.
 *
 * Deux notions distinctes, volontairement séparées :
 *  - le ROLE dit quelles routes sont ouvertes (`middlewares/authorize.js`)
 *  - le PERIMETRE dit sur quels enfants elles s'appliquent (`services/access.service.js`)
 *
 * Un éducateur peut appeler `GET /api/children/:id` (rôle autorise) mais
 * recevra un 403 si l'enfant n'est pas dans ses groupes (périmètre).
 */

export const ROLES = Object.freeze({
  educator: 'Éducateur',
  nurse: 'Infirmière',
  director: 'Directeur',
  family: 'Famille',
  admin: 'Administrateur',
})

export const ROLE_KEYS = Object.keys(ROLES)

/**
 * Groupes de rôles utilisés par les routes.
 *
 * Les declarer ici plutôt que d'enumerer des chaînes dans chaque fichier de
 * routes évite qu'un rôle ajoute plus tard soit oublié a un endroit : c'est
 * exactement ce qui rend une règle d'accès fausse sans que rien ne le signale.
 */

/** Équipe du centre : tout le monde sauf les familles. */
export const STAFF_ROLES = Object.freeze(['educator', 'nurse', 'director', 'admin'])

/** Pilotage : tableau de bord, exports, gestion des comptes. */
export const DIRECTION_ROLES = Object.freeze(['director', 'admin'])

/** Qui saisit le suivi pédagogique (objectifs, séances, comptes-rendus). */
export const PEDAGOGY_ROLES = Object.freeze(['educator', 'director', 'admin'])

/** Qui accede aux données médicales (traitements, médecin référent). */
export const MEDICAL_ROLES = Object.freeze(['nurse', 'director', 'admin'])

/** Voient tous les enfants du centre, sans restriction de groupe. */
export const ROLES_WITH_FULL_SCOPE = Object.freeze(['director', 'nurse', 'admin'])

/** Peuvent consulter les données médicales. */
export const ROLES_WITH_MEDICAL_ACCESS = MEDICAL_ROLES

/** Lecture seule absolue : aucune écriture, quelle que soit la ressource. */
export const READ_ONLY_ROLES = Object.freeze(['family'])

export const USER_STATUSES = Object.freeze({
  active: 'Actif',
  disabled: 'Désactivé',
})
