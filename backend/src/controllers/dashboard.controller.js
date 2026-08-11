import { dashboardService } from '../services/dashboard.service.js'
import { notificationService } from '../services/notification.service.js'

export async function getDashboard(req, res) {
  res.json({ status: 'ok', data: await dashboardService.get(req.query, req.user) })
}

export async function listNotifications(req, res) {
  const { items, summary } = await notificationService.list(req.query, req.user)
  res.json({ status: 'ok', data: items, meta: { summary } })
}

export async function markNotificationRead(req, res) {
  const data = await notificationService.markAsRead(req.params.notificationId, req.user)
  res.json({ status: 'ok', data })
}

export async function markAllNotificationsRead(req, res) {
  res.json({ status: 'ok', data: await notificationService.markAllAsRead(req.user) })
}

export async function subscribeToPush(req, res) {
  res.status(201).json({ status: 'ok', data: await notificationService.subscribe(req.body, req.user) })
}

export async function listPushSubscriptions(req, res) {
  res.json({ status: 'ok', data: await notificationService.listSubscriptions(req.user) })
}

export async function unsubscribeFromPush(req, res) {
  const data = await notificationService.unsubscribe(req.params.subscriptionId, req.user)
  res.json({ status: 'ok', data })
}
