import { Router } from 'express'

import { getSharedGoals, getSharedProgress } from '../controllers/share.controller.js'
import { authenticateFamilyLink } from '../middlewares/authenticate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/**
 * Consultation famille par lien sécurisé : pas de mot de passe, mais un jeton
 * signe qui ne donne accès qu'a la progression d'un seul enfant, en lecture.
 */
router.get('/:token/progress', authenticateFamilyLink, asyncHandler(getSharedProgress))
router.get('/:token/goals', authenticateFamilyLink, asyncHandler(getSharedGoals))

export default router
