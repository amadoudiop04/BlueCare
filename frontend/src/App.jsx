import { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/layout/AppLayout.jsx'
import RouteProgress from '@/components/layout/RouteProgress.jsx'
import RequireAuth from '@/features/auth/RequireAuth.jsx'
import { AuthProvider } from '@/features/auth/AuthContext.jsx'
// Seul ecran importe directement : c'est le premier que voit un visiteur sans
// session, le decouper ajouterait un aller-retour avant le premier affichage.
import LoginPage from '@/pages/LoginPage.jsx'
import {
  AttendancePage,
  ChildFilePage,
  ChildFormPage,
  ChildrenPage,
  DashboardPage,
  FamilySpacePage,
  ForgotPasswordPage,
  MedicationsPage,
  ProfilePage,
  ResetPasswordPage,
  SessionReportPage,
  SharedProgressPage,
  UserEditPage,
  UserFormPage,
  UsersPage,
} from '@/lib/routes.js'

/**
 * Routage de l'application.
 *
 * `RequireAuth` filtre par rôle pour éviter d'ouvrir un écran vide ou un 403.
 * Ce n'est pas la protection : le backend refuse de toute façon les requêtes
 * hors périmètre, quel que soit ce que le front affiche.
 *
 * Les écrans arrivent en fichiers separes (voir `lib/routes.js`). Deux
 * frontières d'attente, et non une seule : celle-ci ne couvre que les pages
 * sans session, l'autre est posee autour du contenu dans `AppLayout`. Une
 * frontière unique ici ferait disparaitre la barre laterale a chaque
 * navigation — l'interface entière clignoterait pour changer de page.
 */
const STAFF = ['educator', 'nurse', 'director', 'admin']

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteProgress full />}>
          <Routes>
            <Route path="/connexion" element={<LoginPage />} />

            {/* Réinitialisation : accessible sans session, c'est tout l'objet. */}
            <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
            <Route path="/reinitialisation/:token" element={<ResetPasswordPage />} />

            {/* Lien famille : consultable sans compte, la portée est dans le jeton. */}
            <Route path="/suivi/:token" element={<SharedProgressPage />} />

            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route
                index
                element={
                  <RequireAuth roles={STAFF}>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="enfants"
                element={
                  <RequireAuth roles={STAFF}>
                    <ChildrenPage />
                  </RequireAuth>
                }
              />
              {/* Avant `:childId`, sinon « nouveau » serait pris pour un identifiant.
                  Un éducateur y a accès depuis qu'il inscrit les enfants de ses
                  groupes ; le serveur borne le groupe possible. */}
              <Route
                path="enfants/nouveau"
                element={
                  <RequireAuth roles={['educator', 'director', 'admin']}>
                    <ChildFormPage />
                  </RequireAuth>
                }
              />
              <Route path="enfants/:childId" element={<ChildFilePage />} />
              <Route
                path="comptes-rendus"
                element={
                  <RequireAuth roles={['educator', 'director', 'admin']}>
                    <SessionReportPage />
                  </RequireAuth>
                }
              />
              <Route
                path="presences"
                element={
                  <RequireAuth roles={STAFF}>
                    <AttendancePage />
                  </RequireAuth>
                }
              />
              <Route
                path="medicaments"
                element={
                  <RequireAuth roles={['nurse', 'director', 'admin']}>
                    <MedicationsPage />
                  </RequireAuth>
                }
              />
              {/* Comptes : meme perimetre que `user.routes.js`, qui reserve tout
                  le routeur a la direction. */}
              <Route
                path="comptes"
                element={
                  <RequireAuth roles={['director', 'admin']}>
                    <UsersPage />
                  </RequireAuth>
                }
              />
              {/* Avant `:userId`, sinon « nouveau » serait pris pour un identifiant. */}
              <Route
                path="comptes/nouveau"
                element={
                  <RequireAuth roles={['director', 'admin']}>
                    <UserFormPage />
                  </RequireAuth>
                }
              />
              <Route
                path="comptes/:userId"
                element={
                  <RequireAuth roles={['director', 'admin']}>
                    <UserEditPage />
                  </RequireAuth>
                }
              />
              <Route path="espace-famille" element={<FamilySpacePage />} />
              <Route path="profil" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
