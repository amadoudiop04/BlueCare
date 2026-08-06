import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/layout/AppLayout.jsx'
import RequireAuth from '@/features/auth/RequireAuth.jsx'
import { AuthProvider } from '@/features/auth/AuthContext.jsx'
import AttendancePage from '@/pages/AttendancePage.jsx'
import ChildFilePage from '@/pages/ChildFilePage.jsx'
import ChildrenPage from '@/pages/ChildrenPage.jsx'
import DashboardPage from '@/pages/DashboardPage.jsx'
import FamilySpacePage from '@/pages/FamilySpacePage.jsx'
import LoginPage from '@/pages/LoginPage.jsx'
import MedicationsPage from '@/pages/MedicationsPage.jsx'
import ProfilePage from '@/pages/ProfilePage.jsx'
import SessionReportPage from '@/pages/SessionReportPage.jsx'
import SharedProgressPage from '@/pages/SharedProgressPage.jsx'

/**
 * Routage de l'application.
 *
 * `RequireAuth` filtre par role pour eviter d'ouvrir un ecran vide ou un 403.
 * Ce n'est pas la protection : le backend refuse de toute facon les requetes
 * hors perimetre, quel que soit ce que le front affiche.
 */
const STAFF = ['educator', 'nurse', 'director']

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />

          {/* Lien famille : consultable sans compte, la portee est dans le jeton. */}
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
            <Route path="enfants/:childId" element={<ChildFilePage />} />
            <Route
              path="comptes-rendus"
              element={
                <RequireAuth roles={['educator', 'director']}>
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
                <RequireAuth roles={['nurse', 'director']}>
                  <MedicationsPage />
                </RequireAuth>
              }
            />
            <Route path="espace-famille" element={<FamilySpacePage />} />
            <Route path="profil" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
