import { apiClient } from '@/api/client.js'

/** Connexion, session et profil courant. */

export async function login({ email, password }) {
  const body = await apiClient.post('/auth/login', { email, password })
  return { user: body.data.user, ...body.meta }
}

export async function fetchMe() {
  const body = await apiClient.get('/auth/me')
  return body.data
}

export async function changePassword({ currentPassword, newPassword }) {
  const body = await apiClient.post('/auth/password', { currentPassword, newPassword })
  return body.data
}

export async function createFamilyLink(childId) {
  const body = await apiClient.post(`/children/${childId}/share-link`, {})
  return body.data
}
