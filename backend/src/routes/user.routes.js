import { Router } from 'express'

import {
  createUser,
  disableUser,
  getUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../controllers/user.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// La gestion des utilisateurs appartient a la direction, sans exception.
router.use(authenticate, authorize('director'))

router.get('/', asyncHandler(listUsers))
router.post('/', asyncHandler(createUser))

router.get('/:userId', asyncHandler(getUser))
router.patch('/:userId', asyncHandler(updateUser))
router.post('/:userId/password', asyncHandler(resetUserPassword))
router.delete('/:userId', asyncHandler(disableUser))

export default router
