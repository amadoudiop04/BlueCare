import { ApiError } from '../utils/ApiError.js'

/** Aucune route n'a repondu : on passe la main au gestionnaire d'erreurs. */
export function notFound(req, res, next) {
  next(ApiError.notFound(`Route introuvable : ${req.method} ${req.originalUrl}`))
}
