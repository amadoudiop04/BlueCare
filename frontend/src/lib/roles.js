/** Vocabulaire des roles, aligne sur `backend/src/constants/roles.js`. */

export const ROLE_LABELS = {
  educator: 'Educateur',
  nurse: 'Infirmiere',
  director: 'Directeur',
  family: 'Famille',
  admin: 'Administrateur',
}


export const roleLabel = (role) => ROLE_LABELS[role] ?? role

export const canWrite = (role) => role !== 'family'

export const canReadMedical = (role) => ['nurse', 'director', 'admin'].includes(role)

/**
 * Droits affiches sur la page profil.
 * Deduits de la matrice appliquee par le backend (`middlewares/authorize.js`
 * et `services/access.service.js`), pour que l ecran ne mente pas sur ce que
 * l utilisateur peut reellement faire.
 */
export function permissionsFor(role) {
  const yes = (label) => ({ label, value: 'Autorise', granted: true })
  const no = (label, reason = 'Refuse') => ({ label, value: reason, granted: false })

  const matrix = {
    educator: [
      { label: 'Comptes-rendus de seance', value: 'Creation', granted: true },
      { label: 'Fiches des enfants de vos groupes', value: 'Lecture', granted: true },
      { label: 'Objectifs pedagogiques', value: 'Creation', granted: true },
      no('Donnees medicales'),
      no('Tableau de bord et gestion des comptes'),
    ],
    nurse: [
      yes('Donnees medicales et traitements'),
      yes('Fiches de tous les enfants'),
      yes('Presences et alertes de sante'),
      no('Comptes-rendus de seance', 'Lecture seule'),
      no('Gestion des comptes'),
    ],
    director: [
      yes('Tableau de bord et statistiques'),
      yes('Toutes les fiches et donnees medicales'),
      yes('Exports PDF'),
      yes('Gestion des utilisateurs'),
      yes('Validation des comptes-rendus'),
    ],
    family: [
      { label: 'Progression de votre enfant', value: 'Lecture', granted: true },
      { label: 'Galerie anonymisee', value: 'Lecture', granted: true },
      { label: 'Rapport PDF', value: 'Telechargement', granted: true },
      no('Comptes-rendus detailles'),
      no('Donnees medicales'),
    ],
    admin: [
      yes('Tous les ecrans et toutes les ecritures'),
      yes('Toutes les fiches, sans restriction de groupe'),
      yes('Donnees medicales et traitements'),
      yes('Tableau de bord, exports et gestion des comptes'),
      { label: 'Double authentification', value: 'Obligatoire', granted: true },
    ],
  }

  return matrix[role] ?? []
}
