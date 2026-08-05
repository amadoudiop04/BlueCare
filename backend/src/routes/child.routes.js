import { Router } from 'express'

import {
  getChildAttendance,
  getChildAttendanceAlerts,
} from '../controllers/attendance.controller.js'
import { getChildGallery } from '../controllers/activity.controller.js'
import {
  createChild,
  deleteChild,
  getChild,
  listChildren,
  updateChild,
} from '../controllers/child.controller.js'
import { exportProgressReport } from '../controllers/export.controller.js'
import { createGoal, getChildProgress, listChildGoals } from '../controllers/goal.controller.js'
import {
  createMedication,
  listChildAdministrations,
  listChildMedications,
} from '../controllers/medication.controller.js'
import { createSession, getChildSessions } from '../controllers/session.controller.js'
import { createFamilyLink } from '../controllers/share.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/**
 * Toutes les routes enfants demandent un jeton. Le role ouvre la route,
 * le perimetre (services/access.service.js) decide de quel enfant il s'agit.
 */
router.use(authenticate)

const staff = authorize('educator', 'nurse', 'director')
const pedagogy = authorize('educator', 'director')
const medical = authorize('nurse', 'director')

router.get('/', asyncHandler(listChildren))
router.post('/', authorize('director'), asyncHandler(createChild))

router.get('/:childId', asyncHandler(getChild))
router.patch('/:childId', medical, asyncHandler(updateChild))
router.delete('/:childId', authorize('director'), asyncHandler(deleteChild))

// Presences
router.get('/:childId/attendance', asyncHandler(getChildAttendance))
router.get('/:childId/attendance/alerts', staff, asyncHandler(getChildAttendanceAlerts))

// Galerie anonymisee
router.get('/:childId/gallery', asyncHandler(getChildGallery))

// Suivi pedagogique
router.get('/:childId/goals', asyncHandler(listChildGoals))
router.post('/:childId/goals', pedagogy, asyncHandler(createGoal))
router.get('/:childId/progress', asyncHandler(getChildProgress))
router.get('/:childId/sessions', staff, asyncHandler(getChildSessions))
router.post('/:childId/sessions', pedagogy, asyncHandler(createSession))

// Donnees medicales
router.get('/:childId/medications', medical, asyncHandler(listChildMedications))
router.post('/:childId/medications', medical, asyncHandler(createMedication))
router.get('/:childId/administrations', medical, asyncHandler(listChildAdministrations))

// Export PDF a destination des familles et partenaires
router.get('/:childId/progress.pdf', asyncHandler(exportProgressReport))

// Lien de suivi a envoyer a une famille
router.post('/:childId/share-link', pedagogy, asyncHandler(createFamilyLink))

export default router
