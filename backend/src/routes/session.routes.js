import { Router } from 'express'

import { PEDAGOGY_ROLES, STAFF_ROLES } from '../constants/roles.js'

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

// Le détail d'une séance contient les observations de l'équipe : il reste interne.
router.use(authenticate, authorize(...STAFF_ROLES))

router.get('/', asyncHandler(listSessions))
router.get('/:sessionId', asyncHandler(getSession))

const canWrite = authorize(...PEDAGOGY_ROLES)

router.patch('/:sessionId', canWrite, asyncHandler(updateSession))
router.post('/:sessionId/cancel', canWrite, asyncHandler(cancelSession))
router.delete('/:sessionId', canWrite, asyncHandler(deleteSession))

// Le compte-rendu se dépose sur la séance qu'il documente.
router.post('/:sessionId/report', canWrite, asyncHandler(createReport))

export default router
