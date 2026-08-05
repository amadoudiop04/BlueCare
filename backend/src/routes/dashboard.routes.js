import { Router } from 'express'

import { getDashboard } from '../controllers/dashboard.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Vue globale du centre : reservee a la direction.
router.get('/', authenticate, authorize('director'), asyncHandler(getDashboard))

export default router
