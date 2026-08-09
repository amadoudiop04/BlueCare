import { pick } from './driver.js'
import * as memory from './memory/session.model.js'
import * as postgres from './supabase/session.model.js'

/**
 * Aiguillage du modele « session » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d ou viennent les donnees :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const sessionModel = pick(postgres.sessionModel, memory.sessionModel)
