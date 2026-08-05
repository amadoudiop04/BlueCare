import { Router } from 'express'

import {
  deleteMedication,
  listDoses,
  recordAdministration,
  updateMedication,
} from '../controllers/medication.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Donnees medicales : infirmiere et direction uniquement.
router.use(authenticate, authorize('nurse', 'director'))

// Prises attendues du jour, source des rappels de medicaments.
router.get('/doses', asyncHandler(listDoses))

router.patch('/:medicationId', asyncHandler(updateMedication))
router.delete('/:medicationId', asyncHandler(deleteMedication))
router.post('/:medicationId/administrations', asyncHandler(recordAdministration))

export default router
