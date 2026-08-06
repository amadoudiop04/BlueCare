import { tokenStore } from '@/lib/tokenStore.js'

/**
 * Client HTTP unique de l'application.
 * Tout appel reseau passe par ici : un seul endroit pour la base URL,
 * le jeton d'authentification et la gestion d'erreur.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

/** Routes ouvertes : y envoyer un jeton perime declencherait un 401 inutile. */
const PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/health', '/share/']

const isPublic = (path) => PUBLIC_PATHS.some((entry) => path.startsWith(entry))

export class ApiError extends Error {
  constructor(message, { status, data }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    /** `{ champ: ['message'] }` renvoye par la validation du serveur. */
    this.details = data?.details ?? null
  }
}

/** Prevenu quand la session tombe, pour que le contexte d'auth deconnecte. */
let onSessionExpired = () => {}

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

/**
 * Un seul rafraichissement a la fois : si trois requetes prennent un 401
 * ensemble, elles attendent le meme appel plutot que d'en lancer trois.
 */
let refreshing = null

async function refreshAccessToken() {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) return null

  refreshing =
    refreshing ??
    (async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!response.ok) return null

        const body = await response.json()
        tokenStore.save({ accessToken: body.meta.accessToken })
        return body.meta.accessToken
      } catch {
        return null
      } finally {
        refreshing = null
      }
    })()

  return refreshing
}

async function send(path, { method, body, headers, token, signal }) {
  const accessToken = token ?? (isPublic(path) ? null : tokenStore.getAccess())

  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  })
}

async function request(path, { method = 'GET', body, headers, token, signal, raw = false } = {}) {
  let response = await send(path, { method, body, headers, token, signal })

  // 401 sur une route protegee : on tente un renouvellement, une seule fois.
  if (response.status === 401 && !isPublic(path) && !token) {
    const renewed = await refreshAccessToken()

    if (renewed) {
      response = await send(path, { method, body, headers, token: renewed, signal })
    } else {
      tokenStore.clear()
      onSessionExpired()
    }
  }

  if (raw) {
    if (!response.ok) throw new ApiError(`Requete echouee (${response.status})`, { status: response.status })
    return response
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    throw new ApiError(data?.message || `Requete echouee (${response.status})`, {
      status: response.status,
      data,
    })
  }

  return data
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  /** Reponse brute, pour les telechargements (PDF). */
  raw: (path, options) => request(path, { ...options, raw: true }),
}

/** Construit `?a=1&b=2` en ignorant les valeurs vides. */
export function query(params = {}) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }

  const serialized = search.toString()
  return serialized ? `?${serialized}` : ''
}
