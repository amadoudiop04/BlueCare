import { Router } from 'express'

import { STAFF_ROLES } from '../constants/roles.js'

import {
  listNotifications,
  listPushSubscriptions,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToPush,
  unsubscribeFromPush,
} from '../controllers/dashboard.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authorize } from '../middlewares/authorize.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Le fil est filtre par role dans le service : chacun ne voit que ce qui le concerne.
router.use(authenticate, authorize(...STAFF_ROLES))

router.get('/', asyncHandler(listNotifications))
router.post('/read', asyncHandler(markAllNotificationsRead))

router.get('/subscriptions', asyncHandler(listPushSubscriptions))
router.post('/subscriptions', asyncHandler(subscribeToPush))
router.delete('/subscriptions/:subscriptionId', asyncHandler(unsubscribeFromPush))

router.post('/:notificationId/read', asyncHandler(markNotificationRead))

export default router
