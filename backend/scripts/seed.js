import { driverName, usesSupabase } from '../src/models/driver.js'
import { seedDemoData } from '../src/models/seed.js'
import { isProduction } from '../src/config/env.js'
import { logger } from '../src/utils/logger.js'

/**
 * Amorçage manuel de la base : `npm run seed --workspace backend`.
 *
 * A lancer une fois après'avoir execute `supabase/schema.sql`. La commande est
 * idempotente : si des enfants existent déjà, elle ne fait rien plutôt que de
 * créer des doublons.
 */

if (isProduction) {
  logger.error('Refus : les données de démonstration ne doivent pas être chargees en production.')
  process.exit(1)
}

if (!usesSupabase) {
  logger.warn(
    'Aucune clef Supabase configuree : le seed ecrirait en memoire et serait ' +
      'perdu a la fin de cette commande. Renseignez SUPABASE_URL et ' +
      'SUPABASE_SERVICE_ROLE_KEY dans backend/.env.',
  )
  process.exit(1)
}

logger.info(`Amorçage du stockage « ${driverName} »...`)

try {
  const result = await seedDemoData()

  if (result.skipped) {
    logger.info(`Rien a faire : ${result.reason}.`)
  } else {
    logger.info(
      `Termine : ${result.children} enfants, ${result.users} comptes, ` +
        `${result.days} jours de presences, objectifs et comptes-rendus sur 6 mois.`,
    )
  }

  process.exit(0)
} catch (error) {
  logger.error("Échec de l'amorçage :", error.message)
  process.exit(1)
}
