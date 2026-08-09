import { pick } from './driver.js'
import * as memory from './memory/medication.model.js'
import * as postgres from './supabase/medication.model.js'

/**
 * Aiguillage du modele « medication » vers le pilote actif.
 *
 * Les services importent ce fichier et ignorent d ou viennent les donnees :
 * brancher Supabase ne change rien au-dessus de cette ligne.
 */
export const medicationModel = pick(postgres.medicationModel, memory.medicationModel)
export const administrationModel = pick(postgres.administrationModel, memory.administrationModel)
