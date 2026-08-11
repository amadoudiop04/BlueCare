import { Router } from 'express'

import { DIRECTION_ROLES, PEDAGOGY_ROLES } from '../constants/roles.js'

import {
  deleteGoal,
  getGoal,
  getGoalProgress,
  listGoals,
  updateGoal,
} from '../controllers/goal.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.use(authenticate)

router.get('/', asyncHandler(listGoals))
router.get('/:goalId', asyncHandler(getGoal))
router.get('/:goalId/progress', asyncHandler(getGoalProgress))

// Définir et faire evoluer un objectif releve de l'équipe pédagogique.
router.patch('/:goalId', authorize(...PEDAGOGY_ROLES), asyncHandler(updateGoal))
router.delete('/:goalId', authorize(...DIRECTION_ROLES), asyncHandler(deleteGoal))

export default router
