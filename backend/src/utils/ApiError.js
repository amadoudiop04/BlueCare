/**
 * Erreur applicative portant un code HTTP.
 * Les controllers la lancent, `errorHandler` la transforme en reponse JSON.
 */
export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.details = details
    this.isOperational = true
  }

  static badRequest(message = 'Requete invalide', details) {
    return new ApiError(400, message, details)
  }

  static unauthorized(message = 'Non authentifie') {
    return new ApiError(401, message)
  }

  static forbidden(message = 'Acces refuse') {
    return new ApiError(403, message)
  }

  static notFound(message = 'Ressource introuvable') {
    return new ApiError(404, message)
  }

  static conflict(message = 'Conflit avec l etat actuel de la ressource', details) {
    return new ApiError(409, message, details)
  }

  static tooManyRequests(message = 'Trop de requetes') {
    return new ApiError(429, message)
  }

  static internal(message = 'Erreur interne du serveur') {
    return new ApiError(500, message)
  }
}
