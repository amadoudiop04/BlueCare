import { apiClient, query } from '@/api/client.js'

/**
 * Comptes du centre.
 *
 * Toutes ces routes sont reservees a la direction : `user.routes.js` applique
 * `authorize('director', 'admin')` sur l'ensemble du routeur. Le front n'a donc
 * pas a re-verifier le role pour la securite, seulement pour eviter d'afficher
 * un ecran qui finirait en 403.
 */

export async function fetchUsers(params) {
  const body = await apiClient.get(`/users${query(params)}`)
  return { items: body.data, pagination: body.meta.pagination }
}

export async function fetchUser(userId) {
  const body = await apiClient.get(`/users/${userId}`)
  return body.data
}

export async function createUser(payload) {
  const body = await apiClient.post('/users', payload)
  return body.data
}

export async function updateUser(userId, payload) {
  const body = await apiClient.patch(`/users/${userId}`, payload)
  return body.data
}

/**
 * Nouveau mot de passe impose par la direction. L'ancien n'est pas demande :
 * c'est la procedure du compte perdu, pas un changement volontaire.
 */
export async function resetUserPassword(userId, password) {
  const body = await apiClient.post(`/users/${userId}/password`, { password })
  return body.data
}

/** Telephone perdu : la direction retire le second facteur, l'agent le refait. */
export async function resetUserMfa(userId) {
  const body = await apiClient.post(`/users/${userId}/mfa/reset`)
  return body.data
}
