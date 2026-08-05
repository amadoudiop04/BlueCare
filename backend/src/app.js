import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { env, isProduction } from './config/env.js'
import routes from './routes/index.js'
import { seedDemoData } from './models/seed.js'
import { notFound } from './middlewares/notFound.js'
import { errorHandler } from './middlewares/errorHandler.js'

/**
 * Construit l'application Express sans la demarrer.
 * Separer app.js de server.js permet de tester l'app sans ouvrir de port.
 */
export function createApp() {
  const app = express()

  // Le stockage est en memoire : sans amorcage, l'application demarre vide.
  if (env.seedDemoData && !isProduction) seedDemoData()

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
