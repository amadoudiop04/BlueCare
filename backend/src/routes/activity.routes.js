import { Router } from 'express'

import {
  createActivity,
  deleteActivity,
  getActivity,
  listActivities,
  updateActivity,
} from '../controllers/activity.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// La vue non anonymisee reste interne : les familles passent par la galerie.
router.use(authenticate, authorize('educator', 'nurse', 'director'))

router.get('/', asyncHandler(listActivities))
router.post('/', authorize('educator', 'director'), asyncHandler(createActivity))

router.get('/:activityId', asyncHandler(getActivity))
router.patch('/:activityId', authorize('educator', 'director'), asyncHandler(updateActivity))
router.delete('/:activityId', authorize('educator', 'director'), asyncHandler(deleteActivity))

export default router
