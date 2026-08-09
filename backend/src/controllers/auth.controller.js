import { authService } from '../services/auth.service.js'
import { mfaService } from '../services/mfa.service.js'
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../utils/cookies.js'
import { verifyPassword } from '../utils/password.js'

/** Connexion, double authentification, session et liens de suivi famille. */

const requestContext = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip })

/**
 * Pose le cookie de session et repond.
 *
 * Le jeton est aussi rendu dans `meta.sessionToken` : le navigateur n'en fait
 * rien (il a le cookie), mais les clients sans gestionnaire de cookies —
 * tests, Postman, scripts — en ont besoin pour l'en-tete `Authorization`.
 */
function respondWithSession(res, { user, token, session, mfaSetupRequired }) {
  setSessionCookie(res, token, session.expiresAt)

  res.json({
    status: 'ok',
    data: { user },
    meta: {
      sessionToken: token,
      expiresAt: session.expiresAt,
      mfaSetupRequired,
    },
  })
}

export async function login(req, res) {
  const result = await authService.login(req.body, requestContext(req))

  // Second facteur actif : pas encore de session, seulement un defi.
  if (result.mfaRequired) {
    res.json({
      status: 'ok',
      data: { mfaRequired: true },
      meta: {
        challengeToken: result.challengeToken,
        recoveryAvailable: result.recoveryAvailable,
      },
    })
    return
  }

  respondWithSession(res, result)
}

export async function verifyMfa(req, res) {
  respondWithSession(res, await authService.verifyMfa(req.body, requestContext(req)))
}

/**
 * Deconnexion.
 *
 * Volontairement sans middleware d authentification : sur un poste partage,
 * se deconnecter doit toujours aboutir, y compris si la session a deja expire.
 * Le jeton est donc relu ici, et la session fermee si elle existe encore.
 */
export async function logout(req, res) {
  const data = await authService.logout(readSessionToken(req))
  clearSessionCookie(res)

  res.json({ status: 'ok', data })
}

export async function me(req, res) {
  res.json({ status: 'ok', data: await authService.me(req.user) })
}

export async function changePassword(req, res) {
  const data = await authService.changePassword(req.user, req.session, req.body)
  res.json({ status: 'ok', data })
}

// --- Mot de passe oublie ----------------------------------------------------

/** Toujours 200 : la reponse ne dit pas si l'adresse existe. */
export async function forgotPassword(req, res) {
  const data = await authService.requestPasswordReset(req.body, requestContext(req))
  res.json({ status: 'ok', data })
}

export async function checkResetToken(req, res) {
  res.json({ status: 'ok', data: await authService.describeResetToken(req.params.token) })
}

export async function resetPassword(req, res) {
  const data = await authService.resetPassword({ ...req.body, token: req.params.token })
  // La reinitialisation ferme toutes les sessions : le cookie local aussi.
  clearSessionCookie(res)

  res.json({ status: 'ok', data })
}

// --- Compte -----------------------------------------------------------------

/** Ce que la suppression entrainerait, a montrer avant de la demander. */
export async function previewAccountDeletion(req, res) {
  res.json({ status: 'ok', data: await authService.describeAccountDeletion(req.user) })
}

export async function deleteAccount(req, res) {
  const data = await authService.deleteOwnAccount(req.user, req.body)
  clearSessionCookie(res)

  res.json({ status: 'ok', data })
}

// --- Appareils connectes ----------------------------------------------------

export async function listSessions(req, res) {
  res.json({ status: 'ok', data: await authService.listSessions(req.user, req.session) })
}

export async function revokeSession(req, res) {
  const data = await authService.revokeSession(req.user, req.params.sessionId, req.session)
  res.json({ status: 'ok', data })
}

export async function revokeOtherSessions(req, res) {
  res.json({ status: 'ok', data: await authService.revokeOtherSessions(req.user, req.session) })
}

// --- Enrolement du second facteur -------------------------------------------

export async function getMfaStatus(req, res) {
  res.json({ status: 'ok', data: await mfaService.status(req.user) })
}

export async function startMfaEnrollment(req, res) {
  res.status(201).json({ status: 'ok', data: await mfaService.beginEnrollment(req.user) })
}

export async function confirmMfaEnrollment(req, res) {
  res.json({ status: 'ok', data: await mfaService.confirmEnrollment(req.user, req.body) })
}

export async function disableMfa(req, res) {
  const data = await mfaService.disable(req.user, req.body, { verifyPassword })
  res.json({ status: 'ok', data })
}
