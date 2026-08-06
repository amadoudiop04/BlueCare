/**
 * Stockage des jetons.
 *
 * `localStorage` garde la session ouverte d'un onglet a l'autre, ce qu'attend
 * une equipe qui travaille sur un poste partage toute la journee. En
 * contrepartie le jeton est lisible par un script de la page : c'est
 * acceptable ici parce que l'API n'accepte aucune origine tierce (CORS) et
 * que l'access token expire en 24h.
 */

const ACCESS_KEY = 'bluecare.accessToken'
const REFRESH_KEY = 'bluecare.refreshToken'

const safe = (action, fallback = null) => {
  try {
    return action()
  } catch {
    // Navigation privee ou stockage sature : on degrade sans casser l'app.
    return fallback
  }
}

export const tokenStore = {
  getAccess: () => safe(() => localStorage.getItem(ACCESS_KEY)),
  getRefresh: () => safe(() => localStorage.getItem(REFRESH_KEY)),

  save({ accessToken, refreshToken }) {
    safe(() => {
      if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken)
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
    })
  },

  clear() {
    safe(() => {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    })
  },
}
