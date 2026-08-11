import { pick } from './driver.js'
import * as memory from './memory/user.model.js'
import * as postgres from './supabase/user.model.js'

/**
 * Aiguillage du modèle « user » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d'ou viennent les données :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const userModel = pick(postgres.userModel, memory.userModel)
export const sanitizeUser = memory.sanitizeUser
