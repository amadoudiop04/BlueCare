import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchMe, login as loginRequest } from '@/api/auth.api.js'
import { setSessionExpiredHandler } from '@/api/client.js'
import { AuthContext } from '@/features/auth/authContext.js'
import { tokenStore } from '@/lib/tokenStore.js'

/**
 * Session de l'utilisateur connecte.
 *
 * Le role et le perimetre ne sont jamais deduits cote client : ils viennent de
 * `GET /auth/me`, relu au demarrage a partir du jeton stocke. Le front s'en
 * sert uniquement pour afficher ou masquer des ecrans — c'est le serveur qui
 * refuse reellement l'acces.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [scope, setScope] = useState(null)
  // Sans jeton stocke, inutile de passer par un etat « chargement » : on sait
  // deja qu'il n'y a pas de session a restaurer.
  const [status, setStatus] = useState(() => (tokenStore.getAccess() ? 'loading' : 'anonymous'))

  const clearSession = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setScope(null)
    setStatus('anonymous')
  }, [])

  // Le client HTTP previent quand le renouvellement de jeton a echoue.
  useEffect(() => {
    setSessionExpiredHandler(clearSession)
    return () => setSessionExpiredHandler(() => {})
  }, [clearSession])

  useEffect(() => {
    if (!tokenStore.getAccess()) return undefined

    let cancelled = false

    fetchMe()
      .then((data) => {
        if (cancelled) return
        setUser(data.user)
        setScope(data.scope)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!cancelled) clearSession()
      })

    return () => {
      cancelled = true
    }
  }, [clearSession])

  const login = useCallback(async (credentials) => {
    const { user: account, accessToken, refreshToken } = await loginRequest(credentials)

    tokenStore.save({ accessToken, refreshToken })
    setUser(account)
    setStatus('authenticated')

    // Le perimetre arrive juste apres : il ne bloque pas l'affichage.
    fetchMe()
      .then((data) => setScope(data.scope))
      .catch(() => setScope(null))

    return account
  }, [])

  const value = useMemo(
    () => ({
      user,
      scope,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      logout: clearSession,
    }),
    [user, scope, status, login, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
