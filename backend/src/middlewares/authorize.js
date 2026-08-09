import { ApiError } from '../utils/ApiError.js'

/**
 * Contrôle d'accès par rôle (RBAC).
 *
 *   router.post('/', authenticate, authorize('director'), asyncHandler(createUser))
 *
 * A placer systematiquement après `authenticate`, qui renseigne `req.user`.
 */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentification requise'))
      return
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      next(ApiError.forbidden('Votre rôle ne permet pas cette action'))
      return
    }

    next()
  }
