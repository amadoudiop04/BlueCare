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
 * Un secret absent fait echouer le demarrage en production plutot que de
 * laisser tourner l'API avec une cle connue de tous. En developpement on
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

  /** Authentification par JWT. */
  auth: {
    jwtSecret: readSecret(process.env.JWT_SECRET, 'JWT_SECRET', 'bluecare-dev-access-secret'),
    // Secret distinct : un refresh token ne doit jamais passer pour un access token.
    refreshSecret: readSecret(
      process.env.JWT_REFRESH_SECRET,
      'JWT_REFRESH_SECRET',
      'bluecare-dev-refresh-secret',
    ),
    accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '24h',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    // Duree de validite d'un lien de suivi envoye a une famille.
    familyLinkTtl: process.env.FAMILY_LINK_TTL ?? '7d',
    issuer: 'bluecare-api',
    bcryptRounds: readNumber(process.env.BCRYPT_ROUNDS, 10),
    minPasswordLength: readNumber(process.env.MIN_PASSWORD_LENGTH, 10),
  },

  /** Seuils de declenchement des alertes d'absences repetees. */
  attendance: {
    // Nombre de jours d'accueil consecutifs manques avant alerte.
    consecutiveThreshold: readNumber(process.env.ATTENDANCE_CONSECUTIVE_THRESHOLD, 3),
    // Largeur de la fenetre glissante d'observation, en jours.
    windowDays: readNumber(process.env.ATTENDANCE_WINDOW_DAYS, 30),
    // Absences non justifiees tolerees sur cette fenetre avant alerte.
    windowThreshold: readNumber(process.env.ATTENDANCE_WINDOW_THRESHOLD, 4),
  },

  /** Suivi pedagogique et notifications. */
  tracking: {
    // Profondeur des courbes d'evolution, en mois.
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
