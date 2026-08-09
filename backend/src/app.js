import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { env } from './config/env.js'
import routes from './routes/index.js'
import { notFound } from './middlewares/notFound.js'
import { errorHandler } from './middlewares/errorHandler.js'

/**
 * Construit l application Express sans la demarrer.
 * Separer app.js de server.js permet de tester l'app sans ouvrir de port.
 *
 * L'amorcage des donnees de demonstration se fait dans `server.js` : il est
 * asynchrone depuis qu il passe par les modeles, et les tests doivent pouvoir
 * construire l'app sans declencher d'ecriture en base.
 */
export function createApp() {
  const app = express()

  /*
   * `credentials` est indispensable depuis que la session vit dans un cookie :
   * sans lui, le navigateur ne l'enverrait pas. En contrepartie l'origine doit
   * etre explicite — le joker `*` est interdit avec des identifiants.
   */
  app.use(cors({ origin: env.corsOrigin, credentials: true }))

  // Le cookie de session est `sameSite: strict` : le navigateur ne l'attache a
  // aucune requete venue d un autre site, ce qui coupe les attaques CSRF.
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(morgan(env.logFormat))

  // Toutes les routes metier sont prefixees par /api
  app.use('/api', routes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
