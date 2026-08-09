import { userModel } from '../models/user.model.js'
import { sessionAuthService } from '../services/session.auth.service.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { readSessionToken } from '../utils/cookies.js'
import { verifyFamilyLinkToken } from '../utils/jwt.js'

/**
 * Vérifie la session et attache l'utilisateur a `req.user`.
 *
 * Le jeton arrive par le cookie `httpOnly` pose a la connexion — le navigateur
 * ne le stocke jamais dans un endroit lisible par JavaScript. L'en-tête
 * `Authorization: Bearer` reste accepte pour les clients qui n'ont pas de
 * gestionnaire de cookies (tests, Postman, scripts) : c'est le même jeton
 * opaque, adosse a la même ligne en base, revocable de la même façon.
 *
 * Le rôle et le périmètre sont relus en base à chaque requête : désactiver un
 * compte ou changer une affectation prend effet immédiatement.
 */

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = readSessionToken(req)
  if (!token) throw ApiError.unauthorized('Session absente')

  const session = await sessionAuthService.resolve(token)
  if (!session) throw ApiError.unauthorized('Session expiree ou revoquee')

  const user = await userModel.findById(session.userId)

  if (!user) throw ApiError.unauthorized('Compte introuvable')
  if (user.status !== 'active') throw ApiError.forbidden('Compte désactivé')

  req.user = user
  req.session = session

  next()
})

/**
 * Lien de suivi famille : jeton signe, sans mot de passe, valable pour un
 * seul enfant et en lecture seule. Il voyage dans l URL (envoyé par e-mail ou
 * SMS), il est donc volontairement de courte durée et sans session associée.
 */
export const authenticateFamilyLink = asyncHandler(async (req, res, next) => {
  const token = req.params.token
  if (!token) throw ApiError.unauthorized('Lien de suivi absent')

  const payload = verifyFamilyLinkToken(token)

  req.user = {
    id: `link:${payload.issuedBy ?? 'inconnu'}`,
    role: 'family',
    childIds: [payload.childId],
    groups: [],
    isShareLink: true,
  }
  req.shareLink = { childId: payload.childId, issuedBy: payload.issuedBy ?? null }

  next()
})
