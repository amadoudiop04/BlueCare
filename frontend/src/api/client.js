/**
 * Client HTTP unique de l application.
 *
 * L application ne detient AUCUN jeton : la session est portee par un cookie
 * `httpOnly` pose par le serveur, que JavaScript ne peut ni lire ni ecrire.
 * Une injection de script n'a donc rien a voler — contrairement a un jeton
 * range dans `localStorage`.
 *
 * En contrepartie chaque appel doit demander l'envoi du cookie, d ou le
 * `credentials: 'include'` systematique ci-dessous.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

class ApiError extends Error {
  constructor(message, { status, data }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    /** `{ champ: ['message'] }` renvoye par la validation du serveur. */
    this.details = data?.details ?? null
  }
}

/** Routes qui n'exigent pas de session : un 401 y est une reponse, pas une expiration. */
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/mfa/verify',
  '/auth/logout',
  '/auth/password/forgot',
  '/auth/password/reset',
  '/health',
  '/share/',
]

const isPublic = (path) => PUBLIC_PATHS.some((entry) => path.startsWith(entry))

/** Prevenu quand la session tombe, pour que le contexte d'auth deconnecte. */
let onSessionExpired = () => {}

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

async function request(path, { method = 'GET', body, headers, signal, raw = false } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    // Le cookie de session ne part que si on le demande explicitement.
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  })

  // Session expiree ou revoquee cote serveur : plus rien a nettoyer localement,
  // il suffit de ramener l utilisateur a l ecran de connexion.
  if (response.status === 401 && !isPublic(path)) onSessionExpired()

  if (raw) {
    if (!response.ok) {
      throw new ApiError(`Requete echouee (${response.status})`, { status: response.status })
    }
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
  // `DELETE` accepte un corps : la suppression de compte y transmet le mot de
  // passe, qui n'a rien a faire dans une URL.
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
