/** Vocabulaire des roles, aligne sur `backend/src/constants/roles.js`. */

export const ROLE_LABELS = {
  educator: 'Educateur',
  nurse: 'Infirmiere',
  director: 'Directeur',
  family: 'Famille',
}

export const ROLE_COLORS = {
  educator: '#1E5FD8',
  nurse: '#14866B',
  director: '#0C1E42',
  family: '#6C9BF0',
}

export const roleLabel = (role) => ROLE_LABELS[role] ?? role

export const canWrite = (role) => role !== 'family'

export const canReadMedical = (role) => role === 'nurse' || role === 'director'

/**
 * Droits affiches sur la page profil.
 * Deduits de la matrice appliquee par le backend (`middlewares/authorize.js`
 * et `services/access.service.js`), pour que l'ecran ne mente pas sur ce que
 * l'utilisateur peut reellement faire.
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
  }

  return matrix[role] ?? []
}
