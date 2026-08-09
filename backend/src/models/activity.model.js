import { pick } from './driver.js'
import * as memory from './memory/activity.model.js'
import * as postgres from './supabase/activity.model.js'

/**
 * Aiguillage du modèle « activity » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d'ou viennent les données :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const activityModel = pick(postgres.activityModel, memory.activityModel)
