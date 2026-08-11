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

// La feuille de présence est un outil d'équipe : les familles n'y ont pas accès.
router.use(authenticate, authorize(...STAFF_ROLES))

// `/alerts` est declare avant toute route paramétrée pour ne pas être capture.
router.get('/alerts', asyncHandler(listAttendanceAlerts))

router.get('/', asyncHandler(getDailySheet))
router.post('/', asyncHandler(recordAttendance))
router.post('/bulk', asyncHandler(recordAttendanceBulk))

router.delete('/:childId/:date', asyncHandler(deleteAttendance))

export default router
