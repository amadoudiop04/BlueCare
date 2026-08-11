import { pick } from './driver.js'
import * as memory from './memory/child.model.js'
import * as postgres from './supabase/child.model.js'

/**
 * Aiguillage du modèle « child » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d'ou viennent les données :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const childModel = pick(postgres.childModel, memory.childModel)
