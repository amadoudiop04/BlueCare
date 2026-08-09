import { createApp } from './app.js'
import { env, isProduction } from './config/env.js'
import { driverName, usesSupabase } from './models/driver.js'
import { seedDemoData } from './models/seed.js'
import { logger } from './utils/logger.js'

/**
 * Le stockage en memoire repart vide a chaque demarrage : on le reamorce pour
 * que `npm run dev` ouvre sur une application deja peuplee. Avec Supabase les
 * donnees survivent, l'amorcage se fait donc une fois, a la main
 * (`npm run seed`), et jamais au demarrage.
 */
async function bootstrap() {
  if (env.seedDemoData && !isProduction && !usesSupabase) {
    try {
      const result = await seedDemoData()
      if (!result.skipped) logger.info('Donnees de demonstration chargees (stockage en memoire)')
    } catch (error) {
      logger.error("Echec de l'amorcage des donnees de demonstration", error.message)
    }
  }

  const app = createApp()

  const server = app.listen(env.port, () => {
    logger.info(
      `API BlueCare demarree sur http://localhost:${env.port} ` +
        `(${env.nodeEnv}, stockage : ${driverName})`,
    )
  })

  // Arret propre : on laisse les requetes en cours se terminer.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      logger.info(`${signal} recu, arret du serveur...`)
      server.close(() => process.exit(0))
    })
  }
}

bootstrap().catch((error) => {
  logger.error('Demarrage impossible', error)
  process.exit(1)
})
