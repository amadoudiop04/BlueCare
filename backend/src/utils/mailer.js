import { env, isProduction } from '../config/env.js'
import { logger } from './logger.js'

/**
 * Envoi de courriels.
 *
 * Aucun fournisseur n'est branche : le centre n'en a pas encore choisi. Le
 * transport par defaut ECRIT dans les logs du serveur, ce qui suffit en
 * developpement pour recuperer un lien de reinitialisation.
 *
 * Brancher un vrai service (SMTP, Resend, Postmark) revient a remplacer
 * `transport` ci-dessous : rien d'autre dans l'application n'envoie de mail.
 *
 * En production, le transport console refuse d'agir plutot que de faire croire
 * qu'un message est parti — un lien de reinitialisation qui n'arrive jamais
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

/** Lien de reinitialisation, adresse a une personne qui a perdu son acces. */
export function sendPasswordResetMail({ email, firstName, token, mfaRequired }) {
  const link = `${env.appUrl}/reinitialisation/${token}`
  const minutes = Math.round(env.auth.resetTtlMinutes)

  return sendMail({
    to: email,
    subject: 'BlueCare - reinitialisation de votre mot de passe',
    text:
      `Bonjour ${firstName},\n\n` +
      `Une reinitialisation de mot de passe a ete demandee pour votre compte BlueCare.\n` +
      `Ouvrez ce lien pour choisir un nouveau mot de passe :\n\n` +
      `${link}\n\n` +
      `Ce lien expire dans ${minutes} minutes et ne fonctionne qu'une fois.\n` +
      (mfaRequired
        ? `Votre compte est protege par un code a usage unique : il vous sera demande.\n`
        : '') +
      `\nSi vous n'etes pas a l'origine de cette demande, ignorez ce message : ` +
      `votre mot de passe actuel reste valable.\n`,
  })
}
