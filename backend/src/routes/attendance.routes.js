import { Router } from 'express'

import { STAFF_ROLES } from '../constants/roles.js'

import {
  deleteAttendance,
  getDailySheet,
  listAttendanceAlerts,
  recordAttendance,
  recordAttendanceBulk,
} from '../controllers/attendance.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// La feuille de presence est un outil d'equipe : les familles n'y ont pas acces.
router.use(authenticate, authorize(...STAFF_ROLES))

// `/alerts` est declare avant toute route parametree pour ne pas etre capture.
router.get('/alerts', asyncHandler(listAttendanceAlerts))

router.get('/', asyncHandler(getDailySheet))
router.post('/', asyncHandler(recordAttendance))
router.post('/bulk', asyncHandler(recordAttendanceBulk))

router.delete('/:childId/:date', asyncHandler(deleteAttendance))

export default router
