import { createClient } from '@supabase/supabase-js'

import { env } from './env.js'
import { logger } from '../utils/logger.js'

/**
 * Client Supabase, cree a la premiere utilisation.
 *
 * L API se connecte avec la cle `service_role`, qui contourne les policies
 * RLS : c est le controle d acces applicatif (`middlewares/authorize.js` et
 * `services/access.service.js`) qui fait autorite, et lui seul est teste.
 * Cette cle donne les pleins pouvoirs sur la base — elle ne doit jamais
 * atteindre le navigateur.
 */

let client = null

export const isSupabaseConfigured = () =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey)

export function supabase() {
  if (client) return client

  if (!isSupabaseConfigured()) {
    throw new Error(
      'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour utiliser le pilote Supabase',
    )
  }

  client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
    // Un serveur n a pas de session a conserver ni a rafraichir.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'bluecare-api' } },
  })

  logger.info(`Supabase : connecte a ${env.supabase.url}`)
  return client
}
