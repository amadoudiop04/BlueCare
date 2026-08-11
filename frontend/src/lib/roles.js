/** Vocabulaire des rôles, aligne sur `backend/src/constants/roles.js`. */

export const ROLE_LABELS = {
  educator: 'Éducateur',
  nurse: 'Infirmière',
  director: 'Directeur',
  family: 'Famille',
  admin: 'Administrateur',
}


export const roleLabel = (role) => ROLE_LABELS[role] ?? role

export const canWrite = (role) => role !== 'family'

export const canReadMedical = (role) => ['nurse', 'director', 'admin'].includes(role)

/**
 * Droits affichés sur la page profil.
 * Deduits de la matrice appliquee par le backend (`middlewares/authorize.js`
 * et `services/access.service.js`), pour que l'écran ne mente pas sur ce que
 * l'utilisateur peut réellement faire.
 */
export function permissionsFor(role) {
  const yes = (label) => ({ label, value: 'Autorisé', granted: true })
  const no = (label, reason = 'Refusé') => ({ label, value: reason, granted: false })

  const matrix = {
    educator: [
      { label: 'Comptes-rendus de séance', value: 'Création', granted: true },
      { label: 'Fiches des enfants de vos groupes', value: 'Lecture et création', granted: true },
      { label: 'Objectifs pédagogiques', value: 'Création', granted: true },
      no('Données médicales'),
      no('Tableau de bord et gestion des comptes'),
    ],
    nurse: [
      yes('Données médicales et traitements'),
      yes('Fiches de tous les enfants'),
      yes('Présences et alertes de santé'),
      no('Comptes-rendus de séance', 'Lecture seule'),
      no('Gestion des comptes'),
    ],
    director: [
      yes('Tableau de bord et statistiques'),
      yes('Toutes les fiches et données médicales'),
      yes('Exports PDF'),
      yes('Gestion des utilisateurs'),
      yes('Validation des comptes-rendus'),
    ],
    family: [
      { label: 'Progression de votre enfant', value: 'Lecture', granted: true },
      { label: 'Galerie anonymisée', value: 'Lecture', granted: true },
      { label: 'Rapport PDF', value: 'Téléchargement', granted: true },
      no('Comptes-rendus détaillés'),
      no('Données médicales'),
    ],
    admin: [
      yes('Tous les écrans et toutes les écritures'),
      yes('Toutes les fiches, sans restriction de groupe'),
      yes('Données médicales et traitements'),
      yes('Tableau de bord, exports et gestion des comptes'),
      { label: 'Double authentification', value: 'Obligatoire', granted: true },
    ],
  }

  return matrix[role] ?? []
}
