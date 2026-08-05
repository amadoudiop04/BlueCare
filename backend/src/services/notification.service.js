import { NOTIFICATION_TYPES, keysOf } from '../constants/domain.js'
import { env } from '../config/env.js'
import { childModel } from '../models/child.model.js'
import { db } from '../models/store.js'
import { reportModel } from '../models/report.model.js'
import { sessionModel } from '../models/session.model.js'
import { ApiError } from '../utils/ApiError.js'
import { addDays, formatFrench, today } from '../utils/dates.js'
import { compact, createErrors, readEnum, readString } from '../utils/validate.js'
import { scopedChildIds } from './access.service.js'
import { attendanceService } from './attendance.service.js'
import { medicationService } from './medication.service.js'
import { reportService } from './report.service.js'

/**
 * Fil de notifications (alertes push).
 *
 * Comme les alertes d'absence, les notifications sont CALCULEES a la demande
 * plutot que stockees : elles refletent toujours l'etat reel des donnees. Un
 * medicament administre, un compte-rendu depose, et la notification disparait
 * d'elle-meme — sans tache de nettoyage.
 *
 * Seul l'acquittement est persiste (`db.notificationReads`), puisqu'il ne se
 * deduit d'aucune donnee metier.
 *
 * L'envoi effectif vers les terminaux (Web Push / FCM) n'est pas branche :
 * `subscribe` conserve les abonnements, `dispatch` reste a ecrire le jour ou
 * un fournisseur sera choisi.
 */

const TYPE_KEYS = keysOf(NOTIFICATION_TYPES)

/** Qui recoit quoi. Un role absent de la liste ne voit jamais ce type. */
const AUDIENCE = Object.freeze({
  'absence-alert': ['director', 'educator'],
  'medication-reminder': ['nurse', 'director'],
  'session-reminder': ['educator', 'director'],
  'report-pending': ['educator', 'director'],
  'health-alert': ['nurse', 'director'],
})

const childRef = (child) =>
  child ? { id: child.id, firstName: child.firstName, lastName: child.lastName, group: child.group } : null

const readKey = (userId, notificationId) => `${userId}:${notificationId}`

async function absenceNotifications(user) {
  const { items } = await attendanceService.listAlerts({}, user)

  return items.flatMap((entry) =>
    entry.alerts.map((alert) => ({
      id: `absence-alert:${entry.child.id}:${alert.rule}:${today()}`,
      type: 'absence-alert',
      severity: alert.severity,
      title: `${entry.child.firstName} ${entry.child.lastName} : absences repetees`,
      message: alert.message,
      child: entry.child,
      link: `/children/${entry.child.id}/attendance`,
      occurredAt: today(),
    })),
  )
}

async function medicationNotifications(user) {
  const { doses } = await medicationService.getDoses({ date: today() }, user)

  return doses
    .filter((dose) => dose.status === 'pending')
    .map((dose) => ({
      id: `medication-reminder:${dose.medicationId}:${dose.date}:${dose.scheduledTime}`,
      type: 'medication-reminder',
      severity: 'warning',
      title: `${dose.scheduledTime} - ${dose.name}`,
      message: `${dose.dosage} pour ${dose.child?.firstName ?? 'un enfant'} a ${dose.scheduledTime}.`,
      child: dose.child,
      link: `/children/${dose.child?.id}/medications`,
      occurredAt: dose.date,
      dueAt: `${dose.date}T${dose.scheduledTime}:00`,
    }))
}

async function sessionNotifications(user) {
  const from = today()
  const to = addDays(from, env.tracking.sessionReminderDays)

  const childIds = await scopedChildIds(user)
  const sessions = await sessionModel.findAll(compact({ childIds, from, to, status: 'planned' }))

  const children = await childModel.findManyByIds([...new Set(sessions.map((s) => s.childId))])
  const childById = new Map(children.map((child) => [child.id, child]))

  return sessions.map((session) => {
    const child = childById.get(session.childId)

    return {
      id: `session-reminder:${session.id}`,
      type: 'session-reminder',
      severity: 'info',
      title: `Seance planifiee le ${formatFrench(session.date)}`,
      message: `${session.title ?? 'Seance'} avec ${child?.firstName ?? 'un enfant'}${
        session.startTime ? ` a ${session.startTime}` : ''
      }.`,
      child: childRef(child),
      link: `/sessions/${session.id}`,
      occurredAt: session.date,
      dueAt: session.startTime ? `${session.date}T${session.startTime}:00` : session.date,
    }
  })
}

async function pendingReportNotifications(user) {
  const { items } = await reportService.listPending({}, user)

  const children = await childModel.findManyByIds([
    ...new Set(items.map((item) => item.session.childId)),
  ])
  const childById = new Map(children.map((child) => [child.id, child]))

  return items.map(({ session, overdue, daysLate }) => ({
    id: `report-pending:${session.id}`,
    type: 'report-pending',
    severity: overdue ? 'warning' : 'info',
    title: `Compte-rendu a saisir (${formatFrench(session.date)})`,
    message: overdue
      ? `Seance du ${formatFrench(session.date)} sans compte-rendu depuis ${daysLate} jours.`
      : `La seance du ${formatFrench(session.date)} attend son compte-rendu.`,
    child: childRef(childById.get(session.childId)),
    link: `/sessions/${session.id}/report`,
    occurredAt: session.date,
  }))
}

async function healthNotifications(user) {
  const childIds = await scopedChildIds(user)
  const reports = await reportModel.findAll(
    compact({ childIds, healthFlagged: true, from: addDays(today(), -7) }),
  )

  const children = await childModel.findManyByIds([...new Set(reports.map((r) => r.childId))])
  const childById = new Map(children.map((child) => [child.id, child]))

  return reports.map((report) => ({
    id: `health-alert:${report.id}`,
    type: 'health-alert',
    severity: 'critical',
    title: 'Point de sante signale',
    message: report.healthFlag?.description ?? 'Un compte-rendu signale un point de sante.',
    child: childRef(childById.get(report.childId)),
    link: `/reports/${report.id}`,
    occurredAt: report.date,
  }))
}

const BUILDERS = {
  'absence-alert': absenceNotifications,
  'medication-reminder': medicationNotifications,
  'session-reminder': sessionNotifications,
  'report-pending': pendingReportNotifications,
  'health-alert': healthNotifications,
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }

export const notificationService = {
  async list(query = {}, user) {
    const errors = createErrors()
    const type = readEnum(query.type, TYPE_KEYS, 'type', errors)
    const severity = readEnum(query.severity, ['critical', 'warning', 'info'], 'severity', errors)
    errors.throwIfAny('Filtres invalides')

    const unreadOnly = query.unreadOnly === 'true'

    // Un role ne recoit que les types qui le concernent.
    const types = (type ? [type] : TYPE_KEYS).filter((entry) =>
      AUDIENCE[entry].includes(user.role),
    )

    const built = await Promise.all(types.map((entry) => BUILDERS[entry](user)))

    const items = built
      .flat()
      .map((notification) => ({
        ...notification,
        read: db.notificationReads.has(readKey(user.id, notification.id)),
      }))
      .filter((notification) => !severity || notification.severity === severity)
      .filter((notification) => !unreadOnly || !notification.read)
      .sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
          String(a.dueAt ?? a.occurredAt).localeCompare(String(b.dueAt ?? b.occurredAt)),
      )

    const byType = Object.fromEntries(
      TYPE_KEYS.map((entry) => [entry, items.filter((item) => item.type === entry).length]),
    )

    return {
      items,
      summary: {
        total: items.length,
        unread: items.filter((item) => !item.read).length,
        critical: items.filter((item) => item.severity === 'critical').length,
        byType,
      },
    }
  },

  /** Acquittement : la seule part du fil qui soit reellement stockee. */
  async markAsRead(notificationId, user) {
    if (typeof notificationId !== 'string' || notificationId.length > 200) {
      throw ApiError.badRequest('Identifiant de notification invalide')
    }

    db.notificationReads.add(readKey(user.id, notificationId))
    return { notificationId, read: true }
  },

  async markAllAsRead(user) {
    const { items } = await this.list({}, user)

    for (const item of items) db.notificationReads.add(readKey(user.id, item.id))

    return { read: items.length }
  },

  /**
   * Enregistre un terminal pour l'envoi push.
   * L'envoi lui-meme (Web Push, FCM) reste a brancher : ces abonnements sont
   * ce dont ce futur service aura besoin.
   */
  async subscribe(payload = {}, user) {
    const errors = createErrors()
    const endpoint = readString(payload.endpoint, 'endpoint', errors, {
      required: true,
      max: 500,
    })
    const platform = readEnum(payload.platform, ['web', 'ios', 'android'], 'platform', errors)
    const keys = payload.keys && typeof payload.keys === 'object' ? payload.keys : null
    errors.throwIfAny('Abonnement invalide')

    const existing = [...db.pushSubscriptions.values()].find(
      (entry) => entry.endpoint === endpoint && entry.userId === user.id,
    )
    if (existing) return existing

    const subscription = {
      id: `sub_${db.pushSubscriptions.size + 1}_${Date.now()}`,
      userId: user.id,
      endpoint,
      platform: platform ?? 'web',
      keys,
      createdAt: new Date().toISOString(),
    }

    db.pushSubscriptions.set(subscription.id, subscription)
    return subscription
  },

  async unsubscribe(subscriptionId, user) {
    const subscription = db.pushSubscriptions.get(subscriptionId)

    if (!subscription || subscription.userId !== user.id) {
      throw ApiError.notFound('Abonnement introuvable')
    }

    db.pushSubscriptions.delete(subscriptionId)
    return { subscriptionId, removed: true }
  },

  async listSubscriptions(user) {
    return [...db.pushSubscriptions.values()].filter((entry) => entry.userId === user.id)
  },
}

export { AUDIENCE }
