import { env, isProduction } from '../config/env.js'
import { isSupabaseConfigured } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

/**
 * Choix du pilote de stockage.
 *
 * Les clefs Supabase présentes -> Postgres. Sinon -> stockage en mémoire.
 * Ce basculement par la configuration permet aux tests de tourner sans réseau
 * ni base a provisionner, tout en faisant tourner exactement le même code
 * metier : seuls les `*.model.js` différent.
 *
 * Le stockage en mémoire ne sort PAS du développement : voir ci-dessous.
 */
export const usesSupabase = isSupabaseConfigured()

export const driverName = usesSupabase ? 'supabase' : 'memory'

/** Choisit l'implementation a exporter, selon le pilote actif. */
export const pick = (supabaseModel, memoryModel) => (usesSupabase ? supabaseModel : memoryModel)

if (!usesSupabase) {
  /*
   * En production, démarrer sur le stockage en mémoire serait le pire des
   * scénarios : l'application répondrait normalement, les équipes saisiraient
   * des comptes-rendus et des présences, et tout disparaîtrait au premier
   * redemarrage — sans le moindre message d'erreur. On refuse de démarrer.
   */
  /*
   * Nommer celle qui manque, et non les deux : sur un hebergeur, la cause est
   * presque toujours une seule variable — oubliee, mal orthographiee, ou posee
   * sur un autre service. Un message qui les cite toutes les deux laisse
   * chercher laquelle.
   */
  const missing = [
    !env.supabase.url && 'SUPABASE_URL',
    !env.supabase.secretKey && 'SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY)',
  ].filter(Boolean)

  if (isProduction) {
    throw new Error(
      `${missing.join(' et ')} : variable(s) absente(s) de l'environnement. ` +
        'Obligatoire(s) en production, sans quoi les données ne seraient ' +
        'conservées nulle part. Voir backend/.env.example.',
    )
  }

  logger.warn(
    `Stockage en mémoire : les données disparaissent au redemarrage. ${missing.join(' et ')} ` +
      'a renseigner pour persister.',
  )
}
