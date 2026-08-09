import { isProduction } from '../config/env.js'
import { isSupabaseConfigured } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

/**
 * Choix du pilote de stockage.
 *
 * Les clefs Supabase presentes -> Postgres. Sinon -> stockage en memoire.
 * Ce basculement par la configuration permet aux tests de tourner sans reseau
 * ni base a provisionner, tout en faisant tourner exactement le meme code
 * metier : seuls les `*.model.js` different.
 *
 * Le stockage en memoire ne sort PAS du developpement : voir ci-dessous.
 */
export const usesSupabase = isSupabaseConfigured()

export const driverName = usesSupabase ? 'supabase' : 'memory'

/** Choisit l'implementation a exporter, selon le pilote actif. */
export const pick = (supabaseModel, memoryModel) => (usesSupabase ? supabaseModel : memoryModel)

if (!usesSupabase) {
  /*
   * En production, demarrer sur le stockage en memoire serait le pire des
   * scenarios : l application repondrait normalement, les equipes saisiraient
   * des comptes-rendus et des presences, et tout disparaitrait au premier
   * redemarrage — sans le moindre message d erreur. On refuse de demarrer.
   */
  if (isProduction) {
    throw new Error(
      'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont obligatoires en production : ' +
        'sans elles les donnees ne seraient conservees nulle part (voir DEPLOIEMENT.md).',
    )
  }

  logger.warn(
    'Stockage en memoire : les donnees disparaissent au redemarrage. ' +
      'Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY pour persister.',
  )
}
