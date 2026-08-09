import { env } from '../src/config/env.js'
import { DIRECTION_ROLES } from '../src/constants/roles.js'
import { driverName, usesSupabase } from '../src/models/driver.js'
import { userModel } from '../src/models/user.model.js'
import { logger } from '../src/utils/logger.js'
import { hashPassword } from '../src/utils/password.js'

/**
 * Cree le tout premier compte de direction : `npm run create-admin`.
 *
 * Sans lui, une base fraiche est un cul-de-sac — les comptes se creent depuis
 * l application, mais il faut deja etre directeur pour y acceder. Ce script est
 * la seule porte d'entree, et il ne sert qu une fois.
 *
 * Contrairement au seed de demonstration, il fonctionne en production : c'est
 * precisement la qu'on en a besoin. Il ne cree donc AUCUNE donnee fictive, et
 * refuse d'ecraser un compte existant.
 *
 * Les identifiants passent par l'environnement, jamais par la ligne de commande :
 * un mot de passe en argument se retrouverait dans l'historique du shell.
 *
 *   ADMIN_EMAIL=direction@centre.fr ADMIN_PASSWORD='...' npm run create-admin
 */

const fail = (message) => {
  logger.error(message)
  process.exit(1)
}

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD ?? ''
const firstName = (process.env.ADMIN_FIRST_NAME ?? 'Direction').trim()
const lastName = (process.env.ADMIN_LAST_NAME ?? 'Centre Papillon Bleu').trim()
const role = (process.env.ADMIN_ROLE ?? 'director').trim()

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  fail('ADMIN_EMAIL manquant ou invalide.')
}

if (password.length < env.auth.minPasswordLength) {
  fail(`ADMIN_PASSWORD doit faire au moins ${env.auth.minPasswordLength} caracteres.`)
}

if (!DIRECTION_ROLES.includes(role)) {
  fail(`ADMIN_ROLE doit valoir ${DIRECTION_ROLES.join(' ou ')}.`)
}

// Ecrire dans le stockage en memoire n aurait aucun effet : le compte
// disparaitrait a la fin de cette commande.
if (!usesSupabase) {
  fail(
    'Aucune clef Supabase configuree : le compte serait perdu immediatement. ' +
      'Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.',
  )
}

if (await userModel.emailExists(email)) {
  fail(`Un compte existe deja pour ${email}. Rien n'a ete modifie.`)
}

try {
  const user = await userModel.create({
    email,
    role,
    firstName,
    lastName,
    passwordHash: await hashPassword(password),
  })

  logger.info(`Compte cree sur « ${driverName} » : ${user.email} (${user.role}).`)
  logger.info('Connectez-vous, puis activez la double authentification depuis « Mon profil ».')
  process.exit(0)
} catch (error) {
  fail(`Echec de la creation : ${error.message}`)
}
