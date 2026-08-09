import { Router } from 'express'

import { PEDAGOGY_ROLES, STAFF_ROLES } from '../constants/roles.js'

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
router.use(authenticate, authorize(...STAFF_ROLES))

router.get('/', asyncHandler(listActivities))
router.post('/', authorize(...PEDAGOGY_ROLES), asyncHandler(createActivity))

router.get('/:activityId', asyncHandler(getActivity))
router.patch('/:activityId', authorize(...PEDAGOGY_ROLES), asyncHandler(updateActivity))
router.delete('/:activityId', authorize(...PEDAGOGY_ROLES), asyncHandler(deleteActivity))

export default router
