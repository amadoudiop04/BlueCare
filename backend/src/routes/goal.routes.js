import { Router } from 'express'

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

// Definir et faire evoluer un objectif releve de l'equipe pedagogique.
router.patch('/:goalId', authorize('educator', 'director'), asyncHandler(updateGoal))
router.delete('/:goalId', authorize('director'), asyncHandler(deleteGoal))

export default router
