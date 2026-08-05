import { Router } from 'express'

import { changePassword, login, me, refresh } from '../controllers/auth.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Seules routes ouvertes sans jeton.
router.post('/login', asyncHandler(login))
router.post('/refresh', asyncHandler(refresh))

router.get('/me', authenticate, asyncHandler(me))
router.post('/password', authenticate, asyncHandler(changePassword))

export default router
