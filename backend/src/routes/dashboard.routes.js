import { Router } from 'express'

import { DIRECTION_ROLES } from '../constants/roles.js'

import { getDashboard } from '../controllers/dashboard.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Vue globale du centre : reservee a la direction.
router.get('/', authenticate, authorize(...DIRECTION_ROLES), asyncHandler(getDashboard))

export default router
