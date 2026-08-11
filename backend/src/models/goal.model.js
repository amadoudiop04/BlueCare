import { pick } from './driver.js'
import * as memory from './memory/goal.model.js'
import * as postgres from './supabase/goal.model.js'

/**
 * Aiguillage du modèle « goal » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d'ou viennent les données :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const goalModel = pick(postgres.goalModel, memory.goalModel)
