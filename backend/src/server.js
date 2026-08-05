import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

const app = createApp()

const server = app.listen(env.port, () => {
  logger.info(`API BlueCare demarree sur http://localhost:${env.port} (${env.nodeEnv})`)
})

// Arret propre : on laisse les requetes en cours se terminer.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info(`${signal} recu, arret du serveur...`)
    server.close(() => process.exit(0))
  })
}
