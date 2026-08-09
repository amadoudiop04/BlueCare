import { isProduction } from '../config/env.js'
import { logger } from '../utils/logger.js'

/**
 * Dernier middleware de la chaîne : formate toute erreur en JSON.
 * Express le reconnait a sa signature a 4 arguments.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode ?? 500

  if (statusCode >= 500) {
    logger.error(err)
  }

  res.status(statusCode).json({
    status: 'error',
    message: statusCode >= 500 && isProduction ? 'Erreur interne du serveur' : err.message,
    ...(err.details ? { details: err.details } : {}),
    ...(isProduction ? {} : { stack: err.stack }),
  })
}
