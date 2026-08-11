import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

import { env } from './env.js'
import { logger } from '../utils/logger.js'

/**
 * Client Supabase, crée a la première utilisation.
 *
 * L API se connecte avec la clé secrète (`sb_secret_...`, anciennement
 * `service_role`), qui contourne les policies RLS : c'est le contrôle d'accès
 * applicatif (`middlewares/authorize.js` et `services/access.service.js`) qui
 * fait autorité, et lui seul est testé. Cette clé donne les pleins pouvoirs
 * sur la base — elle ne doit jamais atteindre le navigateur.
 */

let client = null

export const isSupabaseConfigured = () => Boolean(env.supabase.url && env.supabase.secretKey)

export function supabase() {
  if (client) return client

  if (!isSupabaseConfigured()) {
    throw new Error(
      'SUPABASE_URL et SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) sont requis ' +
        'pour utiliser le pilote Supabase',
    )
  }

  client = createClient(env.supabase.url, env.supabase.secretKey, {
    // Un serveur n'a pas de session a conserver ni a rafraichir.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'bluecare-api' } },
    /*
     * `createClient` construit un client Realtime des l'appel, et celui-ci exige
     * un WebSocket : natif a partir de Node 22, absent avant. Sous Node 20 la
     * creation echouait donc avant meme la premiere requete, alors que l'API
     * n'utilise que REST. On fournit l'implementation `ws`, ce qui rend le
     * demarrage identique sur Node 20 et sur Node 22+.
     */
    realtime: { transport: ws },
  })

  logger.info(`Supabase : connecte a ${env.supabase.url}`)
  return client
}
