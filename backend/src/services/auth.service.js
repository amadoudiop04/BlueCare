import { env } from '../config/env.js'
import { childModel } from '../models/child.model.js'
import { userModel, sanitizeUser } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import {
  expiresAt,
  signAccessToken,
  signFamilyLinkToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js'
import { hashPassword, verifyPassword, wasteTime } from '../utils/password.js'
import { createErrors, readEmail, readString } from '../utils/validate.js'

/** Connexion, renouvellement de jeton et liens de suivi famille. */

function issueTokens(user) {
  const accessToken = signAccessToken(user)

  return {
    accessToken,
    refreshToken: signRefreshToken(user),
    expiresAt: expiresAt(accessToken),
    tokenType: 'Bearer',
  }
}

/**
 * Le mot de passe doit resister a une attaque par dictionnaire : on impose
 * une longueur minimale plutot qu'une composition exotique, plus efficace
 * et moins pousse-a-la-faute pour les equipes.
 */
export function assertPasswordPolicy(password, field, errors) {
  const value = readString(password, field, errors, {
    required: true,
    min: env.auth.minPasswordLength,
    max: 200,
  })

  if (value && /^\s|\s$/.test(password)) {
    errors.add(field, 'Ne doit ni commencer ni finir par un espace')
  }

  return value
}

export const authService = {
  /**
   * Connexion. Le message d'erreur est identique que l'e-mail soit inconnu
   * ou le mot de passe faux, et le temps de reponse est aligne : rien ne
   * permet de decouvrir quels comptes existent.
   */
  async login({ email, password } = {}) {
    const errors = createErrors()
    const normalizedEmail = readEmail(email, 'email', errors, { required: true })
    readString(password, 'password', errors, { required: true, max: 200 })
    errors.throwIfAny('Identifiants invalides')

    const user = await userModel.findByEmailWithSecret(normalizedEmail)

    if (!user) {
      await wasteTime()
      throw ApiError.unauthorized('Identifiants incorrects')
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash)
    if (!passwordMatches) throw ApiError.unauthorized('Identifiants incorrects')
    if (user.status !== 'active') throw ApiError.forbidden('Compte desactive')

    await userModel.update(user.id, { lastLoginAt: new Date().toISOString() })

    return { user: sanitizeUser(user), ...issueTokens(user) }
  },

  /** Echange un refresh token contre un nouvel access token. */
  async refresh({ refreshToken } = {}) {
    if (!refreshToken) throw ApiError.badRequest('Refresh token absent')

    const payload = verifyRefreshToken(refreshToken)
    const user = await userModel.findById(payload.sub)

    if (!user) throw ApiError.unauthorized('Compte introuvable')
    if (user.status !== 'active') throw ApiError.forbidden('Compte desactive')

    return { user, ...issueTokens(user) }
  },

  async me(user) {
    const scope =
      user.role === 'family'
        ? await childModel.findManyByIds(user.childIds ?? [])
        : await childModel.findAll(user.role === 'educator' ? { groups: user.groups } : {})

    return {
      user,
      scope: {
        childCount: scope.length,
        groups: user.role === 'educator' ? (user.groups ?? []) : [...new Set(scope.map((c) => c.group))],
      },
    }
  },

  async changePassword(user, { currentPassword, newPassword } = {}) {
    const errors = createErrors()
    readString(currentPassword, 'currentPassword', errors, { required: true, max: 200 })
    assertPasswordPolicy(newPassword, 'newPassword', errors)
    errors.throwIfAny('Changement de mot de passe invalide')

    const stored = await userModel.findByIdWithSecret(user.id)
    const matches = await verifyPassword(currentPassword, stored?.passwordHash)
    if (!matches) throw ApiError.unauthorized('Mot de passe actuel incorrect')

    if (currentPassword === newPassword) {
      throw ApiError.badRequest('Le nouveau mot de passe doit differer de l ancien')
    }

    await userModel.update(user.id, { passwordHash: await hashPassword(newPassword) })

    return { changed: true }
  },

  /**
   * Genere un lien de suivi pour une famille : jeton signe, un seul enfant,
   * lecture seule, expiration courte. Il circule par e-mail ou SMS, donc il
   * ne donne acces qu'a la progression, jamais aux donnees medicales.
   */
  async createFamilyLink(user, childId, { expiresIn } = {}) {
    const child = await childModel.findById(childId)
    if (!child) throw ApiError.notFound('Enfant introuvable')

    const ttl = expiresIn ?? env.auth.familyLinkTtl
    const token = signFamilyLinkToken({ childId: child.id, issuedBy: user.id }, ttl)

    return {
      token,
      childId: child.id,
      expiresAt: expiresAt(token),
      // Le front construit l'URL definitive ; on donne le chemin d'API.
      path: `/api/share/${token}/progress`,
    }
  },
}
