import 'dotenv/config'

/**
 * Point d'entree unique pour la configuration.
 * Le reste du code lit `env` et ne touche jamais a `process.env` directement.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  logFormat: process.env.LOG_FORMAT ?? 'dev',
}

export const isProduction = env.nodeEnv === 'production'
