import { ROLE_LABELS } from '@/lib/roles.js'

/**
 * Navigation laterale, filtree par role.
 *
 * Cette liste ne fait qu'eviter d'afficher des ecrans inutiles : c'est le
 * serveur qui refuse reellement l'acces (403). Masquer un lien n'est pas une
 * protection, c'est du confort.
 */
const ALL_ITEMS = [
  { to: '/', label: 'Tableau de bord', roles: ['educator', 'nurse', 'director'], end: true },
  { to: '/enfants', label: 'Enfants', roles: ['educator', 'nurse', 'director'] },
  { to: '/comptes-rendus', label: 'Comptes-rendus', roles: ['educator', 'director'] },
  { to: '/presences', label: 'Presences', roles: ['educator', 'nurse', 'director'] },
  { to: '/medicaments', label: 'Medicaments', roles: ['nurse', 'director'] },
  { to: '/espace-famille', label: 'Espace famille', roles: ['family'] },
  { to: '/profil', label: 'Mon profil', roles: ['educator', 'nurse', 'director', 'family'] },
]

export function navigationFor(role) {
  return ALL_ITEMS.filter((item) => item.roles.includes(role)).map((item, index) => ({
    ...item,
    tag: String(index + 1).padStart(2, '0'),
  }))
}

/** Ecran d'accueil apres connexion, selon le role. */
export function homePathFor(role) {
  if (role === 'family') return '/espace-famille'
  if (role === 'nurse') return '/presences'
  return '/'
}

export { ROLE_LABELS }
