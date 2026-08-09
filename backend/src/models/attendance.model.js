import { pick } from './driver.js'
import * as memory from './memory/attendance.model.js'
import * as postgres from './supabase/attendance.model.js'

/**
 * Aiguillage du modèle « attendance » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d'ou viennent les données :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const attendanceModel = pick(postgres.attendanceModel, memory.attendanceModel)
