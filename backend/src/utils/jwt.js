import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'
import { ApiError } from './ApiError.js'

/**
 * Jetons SANS état, pour les deux seuls cas ou une session en base ne convient pas :
 *
 *  - `family-link`   : lien de suivi envoyé par e-mail ou SMS. Il doit
 *                      fonctionner sans compte, donc sans session prealable.
 *  - `mfa-challenge` : jeton intermediaire entre le mot de passe et le code a
 *                      usage unique. Il ne vit que quelques minutes et n'ouvre
 *                      aucune route metier.
 *
 * Les sessions de connexion, elles, sont opaques et stockées en base
 * (`services/session.auth.service.js`) : elles sont ainsi revocables sur-le-champ.
 */

const TOKEN_TYPES = {
  familyLink: 'family-link',
  mfaChallenge: 'mfa-challenge',
}

function sign(payload, expiresIn) {
  return jwt.sign(payload, env.auth.jwtSecret, { expiresIn, issuer: env.auth.issuer })
}

function verify(token, expectedType) {
  let payload

  try {
    payload = jwt.verify(token, env.auth.jwtSecret, { issuer: env.auth.issuer })
  } catch (error) {
    if (error.name === 'TokenExpiredError') throw ApiError.unauthorized('Jeton expire')
    throw ApiError.unauthorized('Jeton invalide')
  }

  // Sans ce contrôle, un lien famille ferait un défi de connexion valide.
  if (payload.type !== expectedType) throw ApiError.unauthorized('Jeton invalide')

  return payload
}

/** Lien de suivi famille : un seul enfant, lecture seule, durée courte. */
export function signFamilyLinkToken({ childId, issuedBy }, expiresIn = env.auth.familyLinkTtl) {
  return sign(
    { sub: childId, childId, issuedBy, role: 'family', type: TOKEN_TYPES.familyLink },
    expiresIn,
  )
}

export const verifyFamilyLinkToken = (token) => verify(token, TOKEN_TYPES.familyLink)

/**
 * Jeton intermediaire entre le mot de passe et le code à usage unique.
 * Il prouve que le premier facteur est passe, et rien d'autre.
 */
export function signMfaChallengeToken(user) {
  return sign({ sub: user.id, type: TOKEN_TYPES.mfaChallenge }, env.mfa.challengeTtl)
}

export const verifyMfaChallengeToken = (token) => verify(token, TOKEN_TYPES.mfaChallenge)

/** Date d'expiration d'un jeton déjà signe, pour l'afficher au client. */
export function expiresAt(token) {
  const { exp } = jwt.decode(token) ?? {}
  return exp ? new Date(exp * 1000).toISOString() : null
}
