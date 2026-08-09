import { Router } from 'express'

import { MEDICAL_ROLES } from '../constants/roles.js'

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

// Données médicales : infirmière et direction uniquement.
router.use(authenticate, authorize(...MEDICAL_ROLES))

// Prises attendues du jour, source des rappels de médicaments.
router.get('/doses', asyncHandler(listDoses))

router.patch('/:medicationId', asyncHandler(updateMedication))
router.delete('/:medicationId', asyncHandler(deleteMedication))
router.post('/:medicationId/administrations', asyncHandler(recordAdministration))

export default router
