import 'dotenv/config'

import { logger } from '../utils/logger.js'

/**
 * Point d entree unique pour la configuration.
 * Le reste du code lit `env` et ne touche jamais a `process.env` directement.
 */

const nodeEnv = process.env.NODE_ENV ?? 'development'
const inProduction = nodeEnv === 'production'

const readNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Un secret absent fait echouer le demarrage en production plutot que de
 * laisser tourner l API avec une cle connue de tous. En developpement on
 * retombe sur une valeur fixe, signalee dans les logs.
 */
const readSecret = (value, name, developmentFallback) => {
  if (value) return value

  if (inProduction) {
    throw new Error(`${name} est obligatoire en production (voir backend/.env.example)`)
  }

  logger.warn(`${name} absent du .env : secret de developpement utilise.`)
  return developmentFallback
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  logFormat: process.env.LOG_FORMAT ?? 'dev',

  /**
   * Authentification.
   *
   * Le secret JWT ne sert plus qu'aux jetons sans etat : le lien de suivi
   * famille et le defi de double authentification. Les sessions de connexion,
   * elles, vivent en base (voir `session.auth.service.js`).
   */
  auth: {
    jwtSecret: readSecret(process.env.JWT_SECRET, 'JWT_SECRET', 'bluecare-dev-secret'),
    // Duree de validite d un lien de suivi envoye a une famille.
    familyLinkTtl: process.env.FAMILY_LINK_TTL ?? '7d',
    issuer: 'bluecare-api',
    bcryptRounds: readNumber(process.env.BCRYPT_ROUNDS, 10),
    minPasswordLength: readNumber(process.env.MIN_PASSWORD_LENGTH, 10),
    // Duree de validite d'un lien de reinitialisation de mot de passe.
    resetTtlMinutes: readNumber(process.env.PASSWORD_RESET_TTL_MINUTES, 60),
  },

  /** Adresse publique du front, pour construire les liens envoyes par courriel. */
  appUrl: (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),

  /** Sessions de connexion, stockees en base et portees par un cookie httpOnly. */
  session: {
    // Inactivite au-dela de laquelle la session s'eteint.
    idleMinutes: readNumber(process.env.SESSION_IDLE_MINUTES, 720),
    // Duree maximale d une session, meme utilisee en continu.
    absoluteMinutes: readNumber(process.env.SESSION_ABSOLUTE_MINUTES, 43200),
    // Frequence minimale de mise a jour de `last_seen_at`, pour ne pas ecrire
    // en base a chaque requete.
    touchMinutes: readNumber(process.env.SESSION_TOUCH_MINUTES, 5),
  },

  /** Double authentification par code a usage unique (TOTP). */
  mfa: {
    // Nom affiche dans Google Authenticator, Authy, 1Password...
    issuer: process.env.MFA_ISSUER ?? 'BlueCare',
    // Pas de temps voisins acceptes, pour absorber le decalage d horloge.
    window: readNumber(process.env.MFA_WINDOW, 1),
    // Duree du jeton intermediaire entre le mot de passe et le code.
    challengeTtl: process.env.MFA_CHALLENGE_TTL ?? '5m',
    // Codes faux toleres avant verrouillage temporaire du compte.
    maxAttempts: readNumber(process.env.MFA_MAX_ATTEMPTS, 5),
    lockMinutes: readNumber(process.env.MFA_LOCK_MINUTES, 15),
    // Impose la 2FA a ces roles : ils voient tout le centre.
    requiredForRoles: (process.env.MFA_REQUIRED_ROLES ?? 'admin,director')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
  },

  /** Seuils de declenchement des alertes d absences repetees. */
  attendance: {
    // Nombre de jours d accueil consecutifs manques avant alerte.
    consecutiveThreshold: readNumber(process.env.ATTENDANCE_CONSECUTIVE_THRESHOLD, 3),
    // Largeur de la fenetre glissante d'observation, en jours.
    windowDays: readNumber(process.env.ATTENDANCE_WINDOW_DAYS, 30),
    // Absences non justifiees tolerees sur cette fenetre avant alerte.
    windowThreshold: readNumber(process.env.ATTENDANCE_WINDOW_THRESHOLD, 4),
  },

  /** Suivi pedagogique et notifications. */
  tracking: {
    // Profondeur des courbes d evolution, en mois.
    progressWindowMonths: readNumber(process.env.PROGRESS_WINDOW_MONTHS, 6),
    // Delai au-dela duquel un compte-rendu manquant est signale, en jours.
    reportDueDays: readNumber(process.env.REPORT_DUE_DAYS, 2),
    // Horizon des rappels de seances planifiees, en jours.
    sessionReminderDays: readNumber(process.env.SESSION_REMINDER_DAYS, 2),
  },

  /**
   * Sel des alias de la galerie anonymisee. Le changer renomme tous les
   * alias : a definir une fois pour toutes en production, et a garder secret.
   */
  anonymizationSalt: process.env.ANONYMIZATION_SALT ?? 'bluecare-dev-salt',

  /**
   * Supabase. Les cles ne sont pas encore utilisees : la couche `models/`
   * est en memoire (voir README). Elles sont declarees ici pour que le
   * branchement ne touche qu'aux modeles.
   */
  supabase: {
    url: process.env.SUPABASE_URL ?? null,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    anonKey: process.env.SUPABASE_ANON_KEY ?? null,
  },

  /** Jeu de donnees de demonstration, jamais charge en production. */
  seedDemoData: (process.env.SEED_DEMO_DATA ?? 'true') !== 'false',
}

export const isProduction = inProduction
