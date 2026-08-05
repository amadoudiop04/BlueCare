import { Router } from 'express'

import {
  deleteReport,
  getReport,
  listPendingReports,
  listReports,
  updateReport,
} from '../controllers/session.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.use(authenticate, authorize('educator', 'nurse', 'director'))

// Declare avant `/:reportId`, sinon « pending » serait pris pour un identifiant.
router.get('/pending', asyncHandler(listPendingReports))

router.get('/', asyncHandler(listReports))
router.get('/:reportId', asyncHandler(getReport))

router.patch('/:reportId', authorize('educator', 'director'), asyncHandler(updateReport))
router.delete('/:reportId', authorize('director'), asyncHandler(deleteReport))

export default router
