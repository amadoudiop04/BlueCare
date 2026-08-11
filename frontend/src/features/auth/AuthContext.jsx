import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  verifyMfa as verifyMfaRequest,
} from '@/api/auth.api.js'
import { hasSessionHint, setSessionExpiredHandler } from '@/api/client.js'
import { AuthContext } from '@/features/auth/authContext.js'

/**
 * Session de l'utilisateur connecte.
 *
 * L'application ne detient aucun jeton : la session vit dans un cookie
 * `httpOnly` et dans la base. La seule façon de savoir si l'on est connecte
 * est donc de le demander au serveur — c'est ce que fait `GET /auth/me` au
 * démarrage.
 *
 * Le rôle et le périmètre viennent de la même réponse, jamais d'une deduction
 * côté client : le front s'en sert pour afficher ou masquer des écrans, c'est
 * le serveur qui refuse réellement l'accès.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [scope, setScope] = useState(null)
  /*
   * loading | authenticated | anonymous.
   *
   * Sans temoin de session, l'état de depart est directement `anonymous` :
   * il n'y a rien a restaurer, donc pas d'écran d'attente et pas d'appel a
   * `/auth/me` — c'est cet appel-la qui laissait un 401 dans la console a
   * chaque ouverture de la page de connexion.
   */
  const [status, setStatus] = useState(() => (hasSessionHint() ? 'loading' : 'anonymous'))

  const forgetSession = useCallback(() => {
    setUser(null)
    setScope(null)
    setStatus('anonymous')
  }, [])

  // Le client HTTP prévient quand le serveur a refuse la session.
  useEffect(() => {
    setSessionExpiredHandler(forgetSession)
    return () => setSessionExpiredHandler(() => {})
  }, [forgetSession])

  /**
   * Restaure la session au chargement, à partir du cookie déjà pose.
   *
   * Le temoin pose par le serveur (`bluecare_signed_in`) dit s'il y a une
   * session a restaurer. Sans lui — première visite, déconnexion, session
   * expiree — on ne demande rien : l'appel serait refuse a coup sur, et le 401
   * qu'il laissait dans la console ressemblait a une panne alors que c'est le
   * fonctionnement normal.
   */
  useEffect(() => {
    if (!hasSessionHint()) return undefined

    let cancelled = false

    fetchMe()
      .then((data) => {
        if (cancelled) return
        setUser(data.user)
        setScope(data.scope)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!cancelled) forgetSession()
      })

    return () => {
      cancelled = true
    }
  }, [forgetSession])

  const openSession = useCallback((account) => {
    setUser(account)
    setStatus('authenticated')

    // Le périmètre arrive juste après : il ne bloque pas l'affichage.
    fetchMe()
      .then((data) => setScope(data.scope))
      .catch(() => setScope(null))

    return account
  }, [])

  /**
   * Relit la session après une modification du compte (profil, périmètre).
   * Le serveur reste la source : on ne recopie pas localement ce qu'on vient
   * d'envoyer, on redemande ce qu'il a réellement enregistre.
   */
  const refresh = useCallback(async () => {
    const data = await fetchMe()
    setUser(data.user)
    setScope(data.scope)

    return data.user
  }, [])

  /**
   * Première étape. Si le compte est protégé par un second facteur, rend
   * `{ mfaRequired, challengeToken }` sans ouvrir de session : c'est l'écran
   * de connexion qui enchaine sur la saisie du code.
   */
  const login = useCallback(
    async (credentials) => {
      const result = await loginRequest(credentials)
      if (result.mfaRequired) return result

      return { user: openSession(result.user) }
    },
    [openSession],
  )

  const completeMfa = useCallback(
    async ({ challengeToken, code }) => {
      const result = await verifyMfaRequest({ challengeToken, code })
      return openSession(result.user)
    },
    [openSession],
  )

  /** La déconnexion supprime la session en base ; le cookie tombe avec elle. */
  const logout = useCallback(async () => {
    await logoutRequest().catch(() => {})
    forgetSession()
  }, [forgetSession])

  const value = useMemo(
    () => ({
      user,
      scope,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      completeMfa,
      logout,
      refresh,
    }),
    [user, scope, status, login, completeMfa, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
