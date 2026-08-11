import { env, isProduction } from '../config/env.js'
import { logger } from './logger.js'

/**
 * Envoi de courriels.
 *
 * Aucun fournisseur n'est branche : le centre n'en a pas encore choisi. Le
 * transport par défaut ECRIT dans les logs du serveur, ce qui suffit en
 * développement pour récupérer un lien de réinitialisation.
 *
 * Brancher un vrai service (SMTP, Resend, Postmark) revient a remplacer
 * `transport` ci-dessous : rien d'autre dans l'application n'envoie de mail.
 *
 * En production, le transport console refuse d'agir plutôt que de faire croire
 * qu'un message est parti — un lien de réinitialisation qui n'arrive jamais
 * est pire qu'une erreur visible.
 */

const consoleTransport = {
  name: 'console',
  async send({ to, subject, text }) {
    if (isProduction) {
      throw new Error(
        "Aucun transport de courriel configure. Renseignez un fournisseur dans utils/mailer.js.",
      )
    }

    logger.info(
      `\n--- COURRIEL (transport console) ---\n` +
        `A       : ${to}\n` +
        `Objet   : ${subject}\n` +
        `${text}\n` +
        `------------------------------------`,
    )

    return { delivered: false, transport: 'console' }
  },
}

let transport = consoleTransport

/** Permet aux tests, ou a un futur fournisseur, de remplacer l'envoi. */
export function setMailTransport(next) {
  transport = next ?? consoleTransport
}

export const mailerName = () => transport.name

export function sendMail(message) {
  return transport.send(message)
}

/** Lien de réinitialisation, adresse a une personne qui a perdu son accès. */
export function sendPasswordResetMail({ email, firstName, token, mfaRequired }) {
  const link = `${env.appUrl}/reinitialisation/${token}`
  const minutes = Math.round(env.auth.resetTtlMinutes)

  return sendMail({
    to: email,
    subject: 'BlueCare - réinitialisation de votre mot de passe',
    text:
      `Bonjour ${firstName},\n\n` +
      `Une réinitialisation de mot de passe a été demandée pour votre compte BlueCare.\n` +
      `Ouvrez ce lien pour choisir un nouveau mot de passe :\n\n` +
      `${link}\n\n` +
      `Ce lien expire dans ${minutes} minutes et ne fonctionne qu'une fois.\n` +
      (mfaRequired
        ? `Votre compte est protégé par un code à usage unique : il vous sera demandé.\n`
        : '') +
      `\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : ` +
      `votre mot de passe actuel reste valable.\n`,
  })
}
