import 'dotenv/config'

import { logger } from '../utils/logger.js'

/**
 * Point d'entree unique pour la configuration.
 * Le reste du code lit `env` et ne touche jamais a `process.env` directement.
 */

const nodeEnv = process.env.NODE_ENV ?? 'development'
const inProduction = nodeEnv === 'production'

const readNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Un secret absent fait échouer le démarrage en production plutôt que de
 * laisser tourner l API avec une clé connue de tous. En développement on
 * retombe sur une valeur fixe, signalee dans les logs.
 */
const readSecret = (value, name, developmentFallback) => {
  if (value) return value

  if (inProduction) {
    throw new Error(`${name} est obligatoire en production (voir backend/.env.example)`)
  }

  logger.warn(`${name} absent du .env : secret de développement utilise.`)
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
   * Le secret JWT ne sert plus qu'aux jetons sans état : le lien de suivi
   * famille et le défi de double authentification. Les sessions de connexion,
   * elles, vivent en base (voir `session.auth.service.js`).
   */
  auth: {
    jwtSecret: readSecret(process.env.JWT_SECRET, 'JWT_SECRET', 'bluecare-dev-secret'),
    // Durée de validité d'un lien de suivi envoyé a une famille.
    familyLinkTtl: process.env.FAMILY_LINK_TTL ?? '7d',
    issuer: 'bluecare-api',
    bcryptRounds: readNumber(process.env.BCRYPT_ROUNDS, 10),
    minPasswordLength: readNumber(process.env.MIN_PASSWORD_LENGTH, 10),
    // Durée de validité d'un lien de réinitialisation de mot de passe.
    resetTtlMinutes: readNumber(process.env.PASSWORD_RESET_TTL_MINUTES, 60),
  },

  /** Adresse publique du front, pour construire les liens envoyés par courriel. */
  appUrl: (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),

  /** Sessions de connexion, stockées en base et portees par un cookie httpOnly. */
  session: {
    // Inactivite au-delà de laquelle la session s'eteint.
    idleMinutes: readNumber(process.env.SESSION_IDLE_MINUTES, 720),
    // Durée maximale d'une session, même utilisée en continu.
    absoluteMinutes: readNumber(process.env.SESSION_ABSOLUTE_MINUTES, 43200),
    // Fréquence minimale de mise à jour de `last_seen_at`, pour ne pas écrire
    // en base à chaque requête.
    touchMinutes: readNumber(process.env.SESSION_TOUCH_MINUTES, 5),
  },

  /** Double authentification par code à usage unique (TOTP). */
  mfa: {
    // Nom affiche dans Google Authenticator, Authy, 1Password...
    issuer: process.env.MFA_ISSUER ?? 'BlueCare',
    // Pas de temps voisins acceptes, pour absorber le décalage d'horloge.
    window: readNumber(process.env.MFA_WINDOW, 1),
    // Durée du jeton intermediaire entre le mot de passe et le code.
    challengeTtl: process.env.MFA_CHALLENGE_TTL ?? '5m',
    // Codes faux toleres avant verrouillage temporaire du compte.
    maxAttempts: readNumber(process.env.MFA_MAX_ATTEMPTS, 5),
    lockMinutes: readNumber(process.env.MFA_LOCK_MINUTES, 15),
    // Impose la 2FA a ces rôles : ils voient tout le centre.
    requiredForRoles: (process.env.MFA_REQUIRED_ROLES ?? 'admin,director')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
  },

  /** Seuils de déclenchement des alertes d'absences répétées. */
  attendance: {
    // Nombre de jours d'accueil consecutifs manques avant alerte.
    consecutiveThreshold: readNumber(process.env.ATTENDANCE_CONSECUTIVE_THRESHOLD, 3),
    // Largeur de la fenêtre glissante d'observation, en jours.
    windowDays: readNumber(process.env.ATTENDANCE_WINDOW_DAYS, 30),
    // Absences non justifiées tolerees sur cette fenêtre avant alerte.
    windowThreshold: readNumber(process.env.ATTENDANCE_WINDOW_THRESHOLD, 4),
  },

  /** Suivi pédagogique et notifications. */
  tracking: {
    // Profondeur des courbes d'évolution, en mois.
    progressWindowMonths: readNumber(process.env.PROGRESS_WINDOW_MONTHS, 6),
    // Délai au-delà duquel un compte-rendu manquant est signale, en jours.
    reportDueDays: readNumber(process.env.REPORT_DUE_DAYS, 2),
    // Horizon des rappels de séances planifiées, en jours.
    sessionReminderDays: readNumber(process.env.SESSION_REMINDER_DAYS, 2),
  },

  /**
   * Sel des alias de la galerie anonymisée. Le changer renomme tous les
   * alias : a définir une fois pour toutes en production, et a garder secret.
   */
  anonymizationSalt: process.env.ANONYMIZATION_SALT ?? 'bluecare-dev-salt',

  /**
   * Supabase. Les clés ne sont pas encore utilisées : la couche `models/`
   * est en mémoire (voir README). Elles sont declarees ici pour que le
   * branchement ne touche qu'aux modèles.
   */
  supabase: {
    url: process.env.SUPABASE_URL ?? null,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    anonKey: process.env.SUPABASE_ANON_KEY ?? null,
  },

  /** Jeu de données de démonstration, jamais charge en production. */
  seedDemoData: (process.env.SEED_DEMO_DATA ?? 'true') !== 'false',
}

export const isProduction = inProduction
