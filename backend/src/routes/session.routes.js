import { Router } from 'express'

import {
  cancelSession,
  createReport,
  deleteSession,
  getSession,
  listSessions,
  updateSession,
} from '../controllers/session.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Le detail d'une seance contient les observations de l'equipe : il reste interne.
router.use(authenticate, authorize('educator', 'nurse', 'director'))

router.get('/', asyncHandler(listSessions))
router.get('/:sessionId', asyncHandler(getSession))

const canWrite = authorize('educator', 'director')

router.patch('/:sessionId', canWrite, asyncHandler(updateSession))
router.post('/:sessionId/cancel', canWrite, asyncHandler(cancelSession))
router.delete('/:sessionId', canWrite, asyncHandler(deleteSession))

// Le compte-rendu se depose sur la seance qu'il documente.
router.post('/:sessionId/report', canWrite, asyncHandler(createReport))

export default router
