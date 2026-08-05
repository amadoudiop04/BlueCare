import { userModel } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { verifyAccessToken, verifyFamilyLinkToken } from '../utils/jwt.js'

/**
 * Verifie le jeton porte par `Authorization: Bearer <token>` et attache
 * l'utilisateur a `req.user`.
 *
 * Le perimetre (groupes, enfants rattaches) est relu en base a chaque
 * requete plutot que lu dans le jeton : desactiver un compte ou changer une
 * affectation prend effet tout de suite, sans attendre l'expiration du jeton.
 */

function readBearerToken(req) {
  const header = req.get('authorization')
  if (!header) return null

  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = readBearerToken(req)
  if (!token) throw ApiError.unauthorized('Jeton d authentification absent')

  const payload = verifyAccessToken(token)
  const user = await userModel.findById(payload.sub)

  if (!user) throw ApiError.unauthorized('Compte introuvable')
  if (user.status !== 'active') throw ApiError.forbidden('Compte desactive')

  req.user = user
  next()
})

/**
 * Lien de suivi famille : jeton signe, sans mot de passe, valable pour un
 * seul enfant et en lecture seule. Le jeton voyage dans l'URL, il est donc
 * volontairement de courte duree.
 */
export const authenticateFamilyLink = asyncHandler(async (req, res, next) => {
  const token = req.params.token ?? readBearerToken(req)
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
