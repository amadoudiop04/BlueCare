import { pick } from './driver.js'
import * as memory from './memory/report.model.js'
import * as postgres from './supabase/report.model.js'

/**
 * Aiguillage du modèle « report » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d'ou viennent les données :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const reportModel = pick(postgres.reportModel, memory.reportModel)
