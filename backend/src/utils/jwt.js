import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'
import { ApiError } from './ApiError.js'

/**
 * Emission et verification des jetons.
 *
 * Trois usages, trois jetons :
 *  - `access`      : porte les appels courants, courte duree (24h par defaut)
 *  - `refresh`     : ne sert qu'a obtenir un nouvel access token, secret distinct
 *  - `family-link` : lien de suivi en lecture seule envoye a une famille
 *
 * Le jeton ne transporte que l'identifiant et le role. Le perimetre (groupes,
 * enfants rattaches) est relu en base a chaque requete : une revocation ou un
 * changement d'affectation prend effet immediatement, sans attendre l'expiration.
 */

const TOKEN_TYPES = { access: 'access', refresh: 'refresh', familyLink: 'family-link' }

function sign(payload, secret, expiresIn) {
  return jwt.sign(payload, secret, { expiresIn, issuer: env.auth.issuer })
}

function verify(token, secret, expectedType) {
  let payload

  try {
    payload = jwt.verify(token, secret, { issuer: env.auth.issuer })
  } catch (error) {
    if (error.name === 'TokenExpiredError') throw ApiError.unauthorized('Jeton expire')
    throw ApiError.unauthorized('Jeton invalide')
  }

  // Sans ce controle, un refresh token ferait un access token parfaitement valide.
  if (payload.type !== expectedType) throw ApiError.unauthorized('Jeton invalide')

  return payload
}

export function signAccessToken(user) {
  return sign(
    { sub: user.id, role: user.role, type: TOKEN_TYPES.access },
    env.auth.jwtSecret,
    env.auth.accessTokenTtl,
  )
}

export function signRefreshToken(user) {
  return sign(
    { sub: user.id, type: TOKEN_TYPES.refresh },
    env.auth.refreshSecret,
    env.auth.refreshTokenTtl,
  )
}

/** Lien de suivi famille : un seul enfant, lecture seule, duree courte. */
export function signFamilyLinkToken({ childId, issuedBy }, expiresIn = env.auth.familyLinkTtl) {
  return sign(
    { sub: childId, childId, issuedBy, role: 'family', type: TOKEN_TYPES.familyLink },
    env.auth.jwtSecret,
    expiresIn,
  )
}

export const verifyAccessToken = (token) => verify(token, env.auth.jwtSecret, TOKEN_TYPES.access)

export const verifyRefreshToken = (token) =>
  verify(token, env.auth.refreshSecret, TOKEN_TYPES.refresh)

export const verifyFamilyLinkToken = (token) =>
  verify(token, env.auth.jwtSecret, TOKEN_TYPES.familyLink)

/** Date d'expiration d'un jeton deja signe, pour l'afficher au client. */
export function expiresAt(token) {
  const { exp } = jwt.decode(token) ?? {}
  return exp ? new Date(exp * 1000).toISOString() : null
}
