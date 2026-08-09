import { createApp } from './app.js'
import { env, isProduction } from './config/env.js'
import { driverName, usesSupabase } from './models/driver.js'
import { seedDemoData } from './models/seed.js'
import { logger } from './utils/logger.js'

/**
 * Le stockage en mémoire repart vide à chaque démarrage : on le reamorce pour
 * que `npm run dev` ouvre sur une application déjà peuplee. Avec Supabase les
 * données survivent, l'amorçage se fait donc une fois, à la main
 * (`npm run seed`), et jamais au démarrage.
 */
async function bootstrap() {
  if (env.seedDemoData && !isProduction && !usesSupabase) {
    try {
      const result = await seedDemoData()
      if (!result.skipped) logger.info('Données de démonstration chargees (stockage en mémoire)')
    } catch (error) {
      logger.error("Échec de l'amorçage des données de démonstration", error.message)
    }
  }

  const app = createApp()

  const server = app.listen(env.port, () => {
    logger.info(
      `API BlueCare demarree sur http://localhost:${env.port} ` +
        `(${env.nodeEnv}, stockage : ${driverName})`,
    )
  })

  // Arrêt propre : on laisse les requêtes en cours se terminer.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      logger.info(`${signal} reçu, arrêt du serveur...`)
      server.close(() => process.exit(0))
    })
  }
}

bootstrap().catch((error) => {
  logger.error('Démarrage impossible', error)
  process.exit(1)
})
