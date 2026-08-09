import { ApiError } from '../utils/ApiError.js'

/**
 * Controle d acces par role (RBAC).
 *
 *   router.post('/', authenticate, authorize('director'), asyncHandler(createUser))
 *
 * A placer systematiquement apres `authenticate`, qui renseigne `req.user`.
 */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentification requise'))
      return
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      next(ApiError.forbidden('Votre role ne permet pas cette action'))
      return
    }

    next()
  }
