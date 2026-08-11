import { healthService } from '../services/health.service.js'

/**
 * Un controller ne fait que : lire la requête, appeler un service, répondre.
 * Aucune logique metier ici.
 */
export async function getHealth(req, res) {
  const health = await healthService.check()
  res.json({ status: 'ok', data: health })
}
