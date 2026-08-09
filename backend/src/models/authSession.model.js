import { pick } from './driver.js'
import * as memory from './memory/authSession.model.js'
import * as postgres from './supabase/authSession.model.js'

/**
 * Aiguillage du modèle « authSession » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d'ou viennent les données :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const authSessionModel = pick(postgres.authSessionModel, memory.authSessionModel)
