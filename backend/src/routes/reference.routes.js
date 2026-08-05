import { Router } from 'express'

import { getReference } from '../controllers/reference.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Le referentiel expose la liste des groupes du centre : il reste derriere le jeton.
router.get('/', authenticate, asyncHandler(getReference))

export default router
