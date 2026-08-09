import { pick } from './driver.js'
import * as memory from './memory/notification.model.js'
import * as postgres from './supabase/notification.model.js'

/**
 * Aiguillage du modele « notification » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d ou viennent les donnees :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const notificationModel = pick(postgres.notificationModel, memory.notificationModel)
