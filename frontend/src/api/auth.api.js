import { apiClient } from '@/api/client.js'

/** Connexion, session et profil courant. */

/**
 * Premiere etape. Deux issues possibles :
 *  - compte sans 2FA : la session est ouverte, le cookie est pose
 *  - compte protege  : `mfaRequired` et un jeton de defi a echanger contre un code
 *
 * Le corps de la reponse contient aussi `sessionToken`, dont le navigateur
 * n a pas l usage : il a le cookie. Seuls les clients sans gestionnaire de
 * cookies (Postman, scripts) s en servent.
 */
export async function login({ email, password }) {
  const body = await apiClient.post('/auth/login', { email, password })

  if (body.data.mfaRequired) {
    return {
      mfaRequired: true,
      challengeToken: body.meta.challengeToken,
      recoveryAvailable: body.meta.recoveryAvailable,
    }
  }

  return { user: body.data.user, mfaSetupRequired: body.meta.mfaSetupRequired }
}

/** Seconde etape : le code a usage unique, ou un code de secours. */
export async function verifyMfa({ challengeToken, code }) {
  const body = await apiClient.post('/auth/mfa/verify', { challengeToken, code })
  return { user: body.data.user }
}

export async function logout() {
  const body = await apiClient.post('/auth/logout')
  return body.data
}

// --- Appareils connectes ----------------------------------------------------

export async function fetchSessions() {
  const body = await apiClient.get('/auth/sessions')
  return body.data
}

export async function revokeSession(sessionId) {
  const body = await apiClient.delete(`/auth/sessions/${sessionId}`)
  return body.data
}

export async function revokeOtherSessions() {
  const body = await apiClient.delete('/auth/sessions')
  return body.data
}

export async function fetchMfaStatus() {
  const body = await apiClient.get('/auth/mfa')
  return body.data
}

export async function startMfaSetup() {
  const body = await apiClient.post('/auth/mfa/setup')
  return body.data
}

export async function enableMfa(code) {
  const body = await apiClient.post('/auth/mfa/enable', { code })
  return body.data
}

export async function disableMfa({ password, code }) {
  const body = await apiClient.post('/auth/mfa/disable', { password, code })
  return body.data
}

export async function fetchMe() {
  const body = await apiClient.get('/auth/me')
  return body.data
}

export async function changePassword({ currentPassword, newPassword }) {
  const body = await apiClient.post('/auth/password', { currentPassword, newPassword })
  return body.data
}

// --- Suppression de son compte ----------------------------------------------

/** Ce que la suppression effacerait et ce qu elle conserverait. */
export async function fetchAccountDeletion() {
  const body = await apiClient.get('/auth/account/deletion')
  return body.data
}

export async function deleteAccount({ password, code }) {
  const body = await apiClient.delete('/auth/account', { body: { password, code } })
  return body.data
}

