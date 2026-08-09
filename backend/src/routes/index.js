import { Router } from 'express'

import activityRoutes from './activity.routes.js'
import attendanceRoutes from './attendance.routes.js'
import authRoutes from './auth.routes.js'
import childRoutes from './child.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import goalRoutes from './goal.routes.js'
import healthRoutes from './health.routes.js'
import medicationRoutes from './medication.routes.js'
import notificationRoutes from './notification.routes.js'
import referenceRoutes from './reference.routes.js'
import reportRoutes from './report.routes.js'
import sessionRoutes from './session.routes.js'
import shareRoutes from './share.routes.js'
import userRoutes from './user.routes.js'

const router = Router()

// Ouvert sans jeton : sonde de santé, connexion, liens de suivi famille.
router.use('/health', healthRoutes)
router.use('/auth', authRoutes)
router.use('/share', shareRoutes)

// Chaque domaine metier pose ensuite ses propres règles d'accès.
router.use('/reference', referenceRoutes)
router.use('/users', userRoutes)
router.use('/children', childRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/activities', activityRoutes)
router.use('/goals', goalRoutes)
router.use('/sessions', sessionRoutes)
router.use('/reports', reportRoutes)
router.use('/medications', medicationRoutes)
router.use('/notifications', notificationRoutes)
router.use('/dashboard', dashboardRoutes)

export default router
