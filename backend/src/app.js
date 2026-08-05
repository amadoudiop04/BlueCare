import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { env } from './config/env.js'
import routes from './routes/index.js'
import { notFound } from './middlewares/notFound.js'
import { errorHandler } from './middlewares/errorHandler.js'

/**
 * Construit l'application Express sans la demarrer.
 * Separer app.js de server.js permet de tester l'app sans ouvrir de port.
 */
export function createApp() {
  const app = express()

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(morgan(env.logFormat))

  // Toutes les routes metier sont prefixees par /api
  app.use('/api', routes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
