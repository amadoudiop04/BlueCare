import { env } from '../config/env.js'
import { DIRECTION_ROLES } from '../constants/roles.js'
import { childModel } from '../models/child.model.js'
import { reportModel } from '../models/report.model.js'
import { sessionModel } from '../models/session.model.js'
import { userModel, sanitizeUser } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { expiresAt, signFamilyLinkToken, signMfaChallengeToken, verifyMfaChallengeToken } from '../utils/jwt.js'
import { hashPassword, verifyPassword, wasteTime } from '../utils/password.js'
import { logger } from '../utils/logger.js'
import { sendPasswordResetMail } from '../utils/mailer.js'
import { createSessionToken, hashSessionToken } from '../utils/sessionToken.js'
import { createThrottle } from '../utils/throttle.js'
import { compact, createErrors, readEmail, readString } from '../utils/validate.js'
import { isMfaRequiredFor, verifySecondFactor } from './mfa.service.js'
import { sessionAuthService } from './session.auth.service.js'

/** Connexion, session, compte et liens de suivi famille. */

const isDirectionRole = (role) => DIRECTION_ROLES.includes(role)

/*
 * Quotas de la demande de réinitialisation.
 *
 * Par adresse, le seuil est bas : cinq liens en un quart d'heure couvrent
 * largement une personne qui s'y reprend a plusieurs fois, et empêchent
 * d'inonder la boite d'un collegue.
 *
 * Par origine, il est plus large : tout un centre peut partager la même sortie
 * internet, et une limite trop basse bloquerait des demandes legitimes. Il
 * reste assez bas pour rendre penible un balayage de l'annuaire.
 */
const RESET_WINDOW_MS = 15 * 60_000
const resetByEmail = createThrottle({ max: 5, windowMs: RESET_WINDOW_MS })
const resetByOrigin = createThrottle({ max: 60, windowMs: RESET_WINDOW_MS })

/** Combien de comptes de direction actifs subsisteraient sans celui-ci. */
async function countOtherActiveDirection(excludeId) {
  const accounts = await Promise.all(
    DIRECTION_ROLES.map((role) => userModel.findAll({ role, status: 'active' })),
  )

  return accounts.flat().filter((account) => account.id !== excludeId).length
}

/**
 * Le mot de passe doit résister a une attaque par dictionnaire : on impose
 * une longueur minimale plutôt qu'une composition exotique, plus efficace
 * et moins pousse-a-la-faute pour les équipes.
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
   * ou le mot de passe faux, et le temps de réponse est aligne : rien ne
   * permet de découvrir quels comptes existent.
   */
  async login({ email, password } = {}, request = {}) {
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
    if (user.status !== 'active') throw ApiError.forbidden('Compte désactivé')

    /*
     * Second facteur actif : aucune session n'est ouverte a ce stade, seulement
     * un jeton de défi de courte durée. Le mot de passe seul ne donne rien.
     */
    if (user.totpEnabled) {
      return {
        mfaRequired: true,
        challengeToken: signMfaChallengeToken(user),
        recoveryAvailable: (user.recoveryCodes ?? []).length > 0,
      }
    }

    return this.openSession(user, request)
  },

  /**
   * Seconde étape de la connexion : le code à usage unique.
   * Le jeton de défi identifie le compte, le code prouve la possession.
   */
  async verifyMfa({ challengeToken, code } = {}, request = {}) {
    if (!challengeToken) throw ApiError.badRequest('Jeton de vérification absent')

    const errors = createErrors()
    readString(code, 'code', errors, { required: true, min: 6, max: 10 })
    errors.throwIfAny('Code invalide')

    const payload = verifyMfaChallengeToken(challengeToken)
    const user = await userModel.findByIdWithSecret(payload.sub)

    if (!user) throw ApiError.unauthorized('Compte introuvable')
    if (user.status !== 'active') throw ApiError.forbidden('Compte désactivé')

    await verifySecondFactor(user, code)

    return this.openSession(user, request)
  },

  /** Ouvre la session et rend le jeton, a poser dans le cookie. */
  async openSession(user, request = {}) {
    const { token, session } = await sessionAuthService.open(user, request)
    await userModel.update(user.id, { lastLoginAt: new Date().toISOString() })

    return {
      user: sanitizeUser(user),
      token,
      session,
      // Le front sait ainsi qu'il doit inviter a activer la 2FA.
      mfaSetupRequired: isMfaRequiredFor(user.role) && !user.totpEnabled,
    }
  },

  /** Ferme la session portée par ce jeton. Silencieux si elle n'existe plus. */
  async logout(token) {
    const session = await sessionAuthService.resolve(token)
    if (session) await sessionAuthService.close(session.id)

    return { loggedOut: true }
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
        groups:
          user.role === 'educator'
            ? (user.groups ?? [])
            : [...new Set(scope.map((child) => child.group))],
      },
    }
  },

  /**
   * Modification de ses propres informations : nom, prenom, adresse e-mail,
   * téléphone. Ni le rôle ni le périmètre : personne ne se promeut soi-même,
   * ces deux champs restent l'affaire de la direction (`user.service.js`).
   *
   * Le mot de passe est exige des que l'adresse change, et elle seule : c'est
   * elle qui recoit les liens de réinitialisation, donc la remplacer depuis
   * une session volee suffirait a s'emparer du compte. Changer de nom ou de
   * téléphone n'ouvre rien, et le demander a chaque correction de coquille
   * n'apporterait qu'une gêne.
   */
  async updateProfile(user, payload = {}) {
    const errors = createErrors()

    const email = readEmail(payload.email, 'email', errors)
    const data = compact({
      email,
      firstName: readString(payload.firstName, 'firstName', errors, { max: 80 }),
      lastName: readString(payload.lastName, 'lastName', errors, { max: 80 }),
      phone: readString(payload.phone, 'phone', errors, { max: 40 }),
    })

    // Vider le champ téléphone, et non le laisser tel quel : `readString` rend
    // `undefined` sur une chaine vide, que `compact` retire ensuite.
    if (payload.phone === '' || payload.phone === null) data.phone = null

    const emailChanged = Boolean(email) && email !== user.email
    if (emailChanged) {
      readString(payload.currentPassword, 'currentPassword', errors, { required: true, max: 200 })
    }

    errors.throwIfAny('Profil invalide')
    if (Object.keys(data).length === 0) throw ApiError.badRequest('Aucune modification demandée')

    if (emailChanged) {
      const stored = await userModel.findByIdWithSecret(user.id)
      if (!(await verifyPassword(payload.currentPassword, stored?.passwordHash))) {
        throw ApiError.unauthorized('Mot de passe incorrect')
      }

      if (await userModel.emailExists(email, { excludeId: user.id })) {
        throw ApiError.conflict('Cette adresse e-mail est déjà utilisée')
      }
    }

    return { user: await userModel.update(user.id, data), emailChanged }
  },

  listSessions: (user, session) => sessionAuthService.list(user.id, session?.id),

  /** Déconnexion d'un autre appareil, depuis la page profil. */
  async revokeSession(user, sessionId, current) {
    const sessions = await sessionAuthService.list(user.id, current?.id)
    if (!sessions.some((entry) => entry.id === sessionId)) {
      throw ApiError.notFound('Session introuvable')
    }

    await sessionAuthService.close(sessionId)
    return { sessionId, revoked: true }
  },

  async revokeOtherSessions(user, current) {
    const revoked = await sessionAuthService.closeOthers(user.id, current?.id)
    return { revoked }
  },

  /**
   * Changer de mot de passe ferme toutes les autres sessions : si le
   * changement fait suite a un soupcon de compromission, laisser les autres
   * appareils connectes viderait le geste de son sens.
   */
  async changePassword(user, session, { currentPassword, newPassword } = {}) {
    const errors = createErrors()
    readString(currentPassword, 'currentPassword', errors, { required: true, max: 200 })
    assertPasswordPolicy(newPassword, 'newPassword', errors)
    errors.throwIfAny('Changement de mot de passe invalide')

    const stored = await userModel.findByIdWithSecret(user.id)
    const matches = await verifyPassword(currentPassword, stored?.passwordHash)
    if (!matches) throw ApiError.unauthorized('Mot de passe actuel incorrect')

    if (currentPassword === newPassword) {
      throw ApiError.badRequest('Le nouveau mot de passe doit différer de l\'ancien')
    }

    await userModel.update(user.id, { passwordHash: await hashPassword(newPassword) })
    const revoked = await sessionAuthService.closeOthers(user.id, session?.id)

    return { changed: true, otherSessionsClosed: revoked }
  },

  /**
   * Demande de réinitialisation.
   *
   * La réponse est toujours la même, que l'adresse existe ou non : sinon,
   * ce formulaire deviendrait un moyen de découvrir qui travaille au centre.
   * Le temps de réponse est aligne pour la même raison.
   */
  async requestPasswordReset({ email } = {}, request = {}) {
    const errors = createErrors()
    const normalizedEmail = readEmail(email, 'email', errors, { required: true })
    errors.throwIfAny('Adresse invalide')

    // Le quota s'applique avant toute lecture en base : il ne doit pas
    // dépendre de l'existence du compte, sinon il la revelerait.
    // Les deux compteurs sont evalues, sans court-circuit : chacun doit
    // enregistrer la tentative, même si l'autre a déjà refuse.
    const emailAccepted = resetByEmail.accept(normalizedEmail)
    const originAccepted = resetByOrigin.accept(request.ip ?? 'origine-inconnue')

    if (!emailAccepted || !originAccepted) {
      throw ApiError.tooManyRequests(
        'Trop de demandes de réinitialisation. Réessayez dans quelques minutes.',
      )
    }

    const user = await userModel.findByEmailWithSecret(normalizedEmail)

    if (!user || user.status !== 'active') {
      await wasteTime()
      return { requested: true }
    }

    const token = createSessionToken()

    // Un seul lien actif : en redemander un invalide le précédent.
    await userModel.update(user.id, {
      resetTokenHash: hashSessionToken(token),
      resetExpiresAt: new Date(Date.now() + env.auth.resetTtlMinutes * 60_000).toISOString(),
    })

    await sendPasswordResetMail({
      email: user.email,
      firstName: user.firstName,
      token,
      mfaRequired: Boolean(user.totpEnabled),
    }).catch((error) => {
      // L'échec d'envoi ne doit pas reveler l'existence du compte : on le
      // journalise, la réponse reste identique.
      logger.error('Envoi du lien de réinitialisation impossible', error.message)
    })

    return { requested: true }
  },

  /** Retrouve le compte d'un lien, en vérifiant qu'il est encore valable. */
  async resolveResetToken(token) {
    if (!token) return null

    const user = await userModel.findByResetTokenHash(hashSessionToken(token))
    if (!user) return null

    if (!user.resetExpiresAt || new Date(user.resetExpiresAt).getTime() <= Date.now()) {
      await userModel.update(user.id, { resetTokenHash: null, resetExpiresAt: null })
      return null
    }

    return user
  },

  /** Ce que l'écran de réinitialisation doit savoir avant d'afficher son formulaire. */
  async describeResetToken(token) {
    const user = await this.resolveResetToken(token)
    if (!user) return { valid: false }

    return {
      valid: true,
      // On ne renvoie ni le nom ni l'adresse : le lien peut avoir été
      // transfere ou intercepte, il ne doit rien apprendre sur le compte.
      mfaRequired: Boolean(user.totpEnabled),
    }
  },

  /**
   * Réinitialisation effective.
   *
   * Le second facteur reste exige quand il est actif. Sans cela, l'accès'a la
   * boite mail suffirait a prendre le compte, ce qui viderait la double
   * authentification de son sens — c'est précisément contre ce scénario
   * qu'elle protege.
   */
  async resetPassword({ token, password, code } = {}) {
    const errors = createErrors()
    assertPasswordPolicy(password, 'password', errors)
    errors.throwIfAny('Mot de passe invalide')

    const user = await this.resolveResetToken(token)
    if (!user) {
      throw ApiError.badRequest('Ce lien est expire ou a déjà été utilise')
    }

    if (user.totpEnabled) {
      const withCode = createErrors()
      readString(code, 'code', withCode, { required: true, min: 6, max: 10 })
      withCode.throwIfAny('Code de vérification requis')

      await verifySecondFactor(user, code)
    }

    await userModel.update(user.id, {
      passwordHash: await hashPassword(password),
      // Le lien ne sert qu'une fois.
      resetTokenHash: null,
      resetExpiresAt: null,
    })

    // Toutes les sessions tombent : si le compte etait compromis, changer le
    // mot de passe sans déconnecter l'intrus ne servirait a rien.
    const revoked = await sessionAuthService.closeAll(user.id)

    return { reset: true, sessionsClosed: revoked }
  },

  /**
   * Ce que la suppression du compte entrainerait, avant de la demander.
   * Affiche dans la boite de confirmation : personne ne doit découvrir après
   * coup que son nom restera attache a des comptes-rendus.
   */
  async describeAccountDeletion(user) {
    const [reports, sessions, remainingAdmins] = await Promise.all([
      reportModel.findAll({ authorId: user.id }),
      sessionModel.findAll({ educatorId: user.id }),
      isDirectionRole(user.role) ? countOtherActiveDirection(user.id) : Promise.resolve(1),
    ])

    const authored = reports.length + sessions.length

    return {
      authoredRecords: authored,
      reports: reports.length,
      sessions: sessions.length,
      // Sans travail rattache, la ligne peut disparaître entièrement.
      mode: authored === 0 ? 'erase' : 'anonymise',
      lastAdministrator: remainingAdmins === 0,
    }
  },

  /**
   * Suppression de son propre compte.
   *
   * Deux issues, selon ce que le compte laisse derrière lui :
   *
   *   erase     — aucun compte-rendu ni séance a son nom : la ligne est
   *               supprimée, il n'en reste rien.
   *   anonymise — du travail lui est rattache. Les données personnelles sont
   *               effacees (nom, e-mail, téléphone, mot de passe, second
   *               facteur), mais la ligne survit pour que les comptes-rendus
   *               gardent un auteur identifiable. Supprimer purement casserait
   *               la tracabilite d'un dossier médical et pédagogique, ce qu'on
   *               n'a pas le droit de faire.
   *
   * Le mot de passe est exige, et le second facteur s'il est actif : un jeton
   * vole ne doit pas suffire a effacer un compte.
   */
  async deleteOwnAccount(user, { password, code } = {}) {
    const errors = createErrors()
    readString(password, 'password', errors, { required: true, max: 200 })
    errors.throwIfAny('Suppression invalide')

    const account = await userModel.findByIdWithSecret(user.id)
    if (!(await verifyPassword(password, account.passwordHash))) {
      throw ApiError.unauthorized('Mot de passe incorrect')
    }

    if (account.totpEnabled) {
      const withCode = createErrors()
      readString(code, 'code', withCode, { required: true, min: 6, max: 10 })
      withCode.throwIfAny('Code de vérification requis')

      await verifySecondFactor(account, code)
    }

    const summary = await this.describeAccountDeletion(user)

    // Un centre sans administrateur actif ne peut plus créer de comptes ni
    // réinitialiser une double authentification : personne ne pourrait rouvrir.
    if (summary.lastAdministrator) {
      throw ApiError.conflict(
        'Vous êtes le dernier compte de direction actif. Nommez un remplacant avant de supprimer le votre.',
      )
    }

    await sessionAuthService.closeAll(user.id)

    if (summary.mode === 'erase') {
      await userModel.remove(user.id)
      return { deleted: true, mode: 'erase' }
    }

    await userModel.update(user.id, {
      // `.invalid` est un domaine réserve : cette adresse ne peut jamais exister.
      email: `supprime.${user.id}@compte-supprime.invalid`,
      firstName: 'Compte',
      lastName: 'supprime',
      phone: null,
      // Un hachage sans mot de passe correspondant : la connexion devient impossible.
      passwordHash: await hashPassword(createSessionToken()),
      status: 'disabled',
      groups: [],
      childIds: [],
      totpEnabled: false,
      totpSecret: null,
      totpConfirmedAt: null,
      totpLastStep: null,
      recoveryCodes: [],
      mfaFailedAttempts: 0,
      mfaLockedUntil: null,
    })

    return { deleted: true, mode: 'anonymise', keptRecords: summary.authoredRecords }
  },

  /**
   * Génère un lien de suivi pour une famille : jeton signe, un seul enfant,
   * lecture seule, expiration courte. Il circule par e-mail ou SMS, donc il
   * ne donne accès qu'a la progression, jamais aux données médicales.
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
      path: `/api/share/${token}/progress`,
    }
  },
}
