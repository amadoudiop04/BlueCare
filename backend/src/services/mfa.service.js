import { env } from '../config/env.js'
import { userModel } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { consumeRecoveryCode, generateRecoveryCodes } from '../utils/recoveryCodes.js'
import { buildOtpAuthUri, generateSecret, verifyCode } from '../utils/totp.js'
import { createErrors, readString } from '../utils/validate.js'

/**
 * Double authentification par code à usage unique.
 *
 * Déroulement de l'enrôlement :
 *   1. `beginEnrollment` crée un secret et le renvoie une seule fois, sous
 *      forme d'URI a scanner. La 2FA n'est PAS encore active.
 *   2. `confirmEnrollment` vérifie que l'application produit bien les bons
 *      codes avant d'activer — sans cette étape, un scan raté enfermerait
 *      l'utilisateur dehors.
 *   3. Les codes de secours sont montrés a ce moment-là, et jamais plus.
 */

export const isMfaRequiredFor = (role) => env.mfa.requiredForRoles.includes(role)

/** Le compte est-il verrouille après trop d'échecs ? */
function assertNotLocked(user) {
  if (!user.mfaLockedUntil) return

  const until = new Date(user.mfaLockedUntil)
  if (until <= new Date()) return

  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60000))
  throw ApiError.forbidden(
    `Trop de codes erronés. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
  )
}

async function registerFailure(user) {
  const attempts = (user.mfaFailedAttempts ?? 0) + 1

  if (attempts >= env.mfa.maxAttempts) {
    const until = new Date(Date.now() + env.mfa.lockMinutes * 60000).toISOString()
    await userModel.update(user.id, { mfaFailedAttempts: 0, mfaLockedUntil: until })

    throw ApiError.forbidden(
      `Trop de codes erronés. Compte verrouillé ${env.mfa.lockMinutes} minutes.`,
    )
  }

  await userModel.update(user.id, { mfaFailedAttempts: attempts })
  throw ApiError.unauthorized('Code de vérification incorrect')
}

const clearFailures = (userId, patch = {}) =>
  userModel.update(userId, { mfaFailedAttempts: 0, mfaLockedUntil: null, ...patch })

/**
 * Vérifie un code TOTP ou un code de secours, et consomme ce qui doit l'être.
 * Rend le compte à jour, ou lève une erreur.
 */
export async function verifySecondFactor(user, code) {
  assertNotLocked(user)

  if (!user.totpEnabled || !user.totpSecret) {
    throw ApiError.badRequest("La double authentification n'est pas activée sur ce compte")
  }

  const step = verifyCode(user.totpSecret, code, { window: env.mfa.window })

  if (step !== null) {
    // Un code reste valable ~90 secondes avec la tolérance d'horloge :
    // refuser un pas déjà consommé empêche de le rejouer.
    if (user.totpLastStep !== null && user.totpLastStep !== undefined && step <= Number(user.totpLastStep)) {
      throw ApiError.unauthorized('Ce code a déjà été utilisé, attendez le suivant')
    }

    return clearFailures(user.id, { totpLastStep: step })
  }

  // Pas un code TOTP : peut-être un code de secours.
  const remaining = consumeRecoveryCode(code, user.recoveryCodes ?? [])
  if (remaining) return clearFailures(user.id, { recoveryCodes: remaining })

  return registerFailure(user)
}

export const mfaService = {
  /** Étape 1 : crée le secret et rend l'URI a scanner. */
  async beginEnrollment(user) {
    const account = await userModel.findByIdWithSecret(user.id)

    if (account.totpEnabled) {
      throw ApiError.conflict('La double authentification est déjà activée sur ce compte')
    }

    const secret = generateSecret()
    await userModel.update(user.id, { totpSecret: secret, totpEnabled: false })

    return {
      secret,
      otpauthUri: buildOtpAuthUri({
        secret,
        account: account.email,
        issuer: env.mfa.issuer,
      }),
      // A afficher tel quel : c'est l'unique occasion de noter ce secret.
      instructions:
        'Scannez ce code dans votre application d authentification, puis saisissez ' +
        'le code a 6 chiffres qu elle affiche pour confirmer.',
    }
  },

  /** Étape 2 : confirme que l'application est bien synchronisée, puis active. */
  async confirmEnrollment(user, payload = {}) {
    const errors = createErrors()
    const code = readString(payload.code, 'code', errors, { required: true, min: 6, max: 10 })
    errors.throwIfAny('Code invalide')

    const account = await userModel.findByIdWithSecret(user.id)

    if (account.totpEnabled) {
      throw ApiError.conflict('La double authentification est déjà activée')
    }
    if (!account.totpSecret) {
      throw ApiError.badRequest('Commencez par générer un secret')
    }

    const step = verifyCode(account.totpSecret, code, { window: env.mfa.window })
    if (step === null) {
      throw ApiError.unauthorized(
        'Code incorrect. Vérifiez que l\'heure du téléphone est à jour.',
      )
    }

    const { codes, hashes } = generateRecoveryCodes()

    await userModel.update(user.id, {
      totpEnabled: true,
      totpConfirmedAt: new Date().toISOString(),
      totpLastStep: step,
      recoveryCodes: hashes,
      mfaFailedAttempts: 0,
      mfaLockedUntil: null,
    })

    return {
      enabled: true,
      // Montrés une seule fois : ensuite seuls les hachages sont conservés.
      recoveryCodes: codes,
    }
  },

  /**
   * Désactivation par l'utilisateur : mot de passe ET code valide exigés.
   * Un jeton volé ne doit pas suffire a retirer le second facteur.
   */
  async disable(user, payload = {}, { verifyPassword }) {
    const errors = createErrors()
    const password = readString(payload.password, 'password', errors, { required: true, max: 200 })
    const code = readString(payload.code, 'code', errors, { required: true, min: 6, max: 10 })
    errors.throwIfAny('Désactivation invalide')

    if (isMfaRequiredFor(user.role)) {
      throw ApiError.forbidden(
        'La double authentification est obligatoire pour votre rôle et ne peut pas être retirée',
      )
    }

    const account = await userModel.findByIdWithSecret(user.id)
    if (!account.totpEnabled) throw ApiError.badRequest('La double authentification n\'est pas activée')

    if (!(await verifyPassword(password, account.passwordHash))) {
      throw ApiError.unauthorized('Mot de passe incorrect')
    }

    await verifySecondFactor(account, code)

    await userModel.update(user.id, {
      totpEnabled: false,
      totpSecret: null,
      totpConfirmedAt: null,
      totpLastStep: null,
      recoveryCodes: [],
    })

    return { enabled: false }
  },

  /**
   * Réinitialisation par la direction, pour un compte dont le téléphone est
   * perdu. L'utilisateur devra refaire l'enrôlement a sa prochaine connexion.
   */
  async resetFor(userId) {
    const account = await userModel.findById(userId)
    if (!account) throw ApiError.notFound('Utilisateur introuvable')

    await userModel.update(userId, {
      totpEnabled: false,
      totpSecret: null,
      totpConfirmedAt: null,
      totpLastStep: null,
      recoveryCodes: [],
      mfaFailedAttempts: 0,
      mfaLockedUntil: null,
    })

    return { userId, enabled: false }
  },

  async status(user) {
    const account = await userModel.findByIdWithSecret(user.id)

    return {
      enabled: Boolean(account.totpEnabled),
      required: isMfaRequiredFor(account.role),
      enrollmentStarted: Boolean(account.totpSecret) && !account.totpEnabled,
      confirmedAt: account.totpConfirmedAt ?? null,
      recoveryCodesLeft: (account.recoveryCodes ?? []).length,
    }
  },
}
