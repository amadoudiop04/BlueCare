import { pick } from './driver.js'
import * as memory from './memory/activity.model.js'
import * as postgres from './supabase/activity.model.js'

/**
 * Aiguillage du modele « activity » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d ou viennent les donnees :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const activityModel = pick(postgres.activityModel, memory.activityModel)
