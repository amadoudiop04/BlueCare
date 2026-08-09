import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth.js'
import { homePathFor } from '@/lib/navigation.js'

/**
 * Garde de route.
 *
 * Elle evite d'afficher un ecran vide ou un 403 a un utilisateur qui n'a rien
 * a y faire — ce n est pas une mesure de securite : le serveur refuse de
 * toute facon les requetes hors perimetre.
 */
function RequireAuth({ roles, children }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-[13px] text-muted">
        Ouverture de la session…
      </div>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />
  }

  return children
}

export default RequireAuth
