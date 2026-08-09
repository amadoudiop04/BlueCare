import { pick } from './driver.js'
import * as memory from './memory/goal.model.js'
import * as postgres from './supabase/goal.model.js'

/**
 * Aiguillage du modele « goal » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d ou viennent les donnees :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const goalModel = pick(postgres.goalModel, memory.goalModel)
