import { lazy } from 'react'

/**
 * Écrans de l'application, charges a la demande.
 *
 * Sans ce découpage, ouvrir la page de connexion telechargeait les dix-huit
 * écrans — y compris la gestion des comptes qu'un educateur ne verra jamais.
 * Chaque page devient ici un fichier separe, demande au moment ou on y va.
 *
 * Un chargement a la demande, naïvement, deplace simplement l'attente : elle
 * apparait au clic au lieu du démarrage. D'ou `preload`, attache a chaque
 * écran : la barre laterale l'appelle des le survol du lien, si bien que le
 * fichier est en general déjà la quand le clic arrive.
 *
 * L'écran de connexion, lui, reste dans le paquet principal : c'est le premier
 * — et souvent le seul — que voit un visiteur sans session. Le decouper
 * ajouterait un aller-retour avant le tout premier affichage.
 */
function route(importer) {
  const Component = lazy(importer)
  /* `React.lazy` ne memorise rien tant qu'il n'est pas rendu ; l'import, lui,
     est dedoublonne par le navigateur : l'appeler dix fois ne coute qu'une
     requête. */
  Component.preload = importer
  return Component
}

export const AttendancePage = route(() => import('@/pages/AttendancePage.jsx'))
export const ChildFilePage = route(() => import('@/pages/ChildFilePage.jsx'))
export const ChildFormPage = route(() => import('@/pages/ChildFormPage.jsx'))
export const ChildrenPage = route(() => import('@/pages/ChildrenPage.jsx'))
export const DashboardPage = route(() => import('@/pages/DashboardPage.jsx'))
export const FamilySpacePage = route(() => import('@/pages/FamilySpacePage.jsx'))
export const ForgotPasswordPage = route(() => import('@/pages/ForgotPasswordPage.jsx'))
export const MedicationsPage = route(() => import('@/pages/MedicationsPage.jsx'))
export const ProfilePage = route(() => import('@/pages/ProfilePage.jsx'))
export const ResetPasswordPage = route(() => import('@/pages/ResetPasswordPage.jsx'))
export const SessionReportPage = route(() => import('@/pages/SessionReportPage.jsx'))
export const SharedProgressPage = route(() => import('@/pages/SharedProgressPage.jsx'))
export const UserEditPage = route(() => import('@/pages/UserEditPage.jsx'))
export const UserFormPage = route(() => import('@/pages/UserFormPage.jsx'))
export const UsersPage = route(() => import('@/pages/UsersPage.jsx'))

/** Chemins fixes de la barre laterale et des boutons d'action. */
const EXACT_ROUTES = {
  '/': DashboardPage,
  '/enfants': ChildrenPage,
  '/enfants/nouveau': ChildFormPage,
  '/comptes-rendus': SessionReportPage,
  '/presences': AttendancePage,
  '/medicaments': MedicationsPage,
  '/comptes': UsersPage,
  '/comptes/nouveau': UserFormPage,
  '/espace-famille': FamilySpacePage,
  '/profil': ProfilePage,
}

/** Chemins portant un identifiant : `/enfants/abc123`, `/comptes/xyz`. */
const DYNAMIC_ROUTES = [
  [/^\/enfants\/[^/]+$/, ChildFilePage],
  [/^\/comptes\/[^/]+$/, UserEditPage],
]

function pageFor(path) {
  // `/comptes-rendus?enfant=abc` mene au même écran que `/comptes-rendus`.
  const route = path.split('?')[0]
  if (EXACT_ROUTES[route]) return EXACT_ROUTES[route]

  return DYNAMIC_ROUTES.find(([pattern]) => pattern.test(route))?.[1] ?? null
}

/**
 * Telecharge d'avance le fichier d'un écran.
 *
 * Appele au survol et au focus clavier d'un lien : l'intention precede le clic
 * d'une centaine de millisecondes, largement de quoi charger le fichier. Sans
 * effet si l'écran est déjà en cache, et sans conséquence s'il n'est jamais
 * ouvert — c'est une requête de plus, pas un rendu.
 */
export function prefetchPath(path) {
  if (!path) return
  pageFor(path)?.preload?.()
}
