import { healthService } from '../services/health.service.js'

/**
 * Un controller ne fait que : lire la requete, appeler un service, repondre.
 * Aucune logique metier ici.
 */
export async function getHealth(req, res) {
  const health = await healthService.check()
  res.json({ status: 'ok', data: health })
}
