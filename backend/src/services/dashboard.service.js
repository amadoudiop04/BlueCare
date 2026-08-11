import { DISABILITY_TYPES, GOAL_STATUSES, keysOf } from '../constants/domain.js'
import { env } from '../config/env.js'
import { attendanceModel } from '../models/attendance.model.js'
import { childModel } from '../models/child.model.js'
import { goalModel } from '../models/goal.model.js'
import { sessionModel } from '../models/session.model.js'
import { summarizeAttendance } from '../utils/attendanceAlerts.js'
import { addDays, today } from '../utils/dates.js'
import { createErrors, readInteger } from '../utils/validate.js'
import { attendanceService } from './attendance.service.js'
import { averageProgress } from './goal.service.js'
import { reportService } from './report.service.js'

/**
 * Vue globale pour la direction : ce qui se passe aujourd'hui, ce qui derape,
 * ce qui attend une action.
 *
 * Tout est recalcule a la demande à partir des mêmes services que les écrans
 * de détail : le tableau de bord ne peut donc pas diverger de ce que voient
 * les éducateurs.
 */

const GOAL_STATUS_KEYS = keysOf(GOAL_STATUSES)

const countBy = (items, pick) =>
  items.reduce((counts, item) => {
    const key = pick(item)
    if (key === undefined || key === null) return counts

    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})

export const dashboardService = {
  async get(query = {}, user) {
    const errors = createErrors()
    const days =
      readInteger(query.days, 'days', errors, { min: 7, max: 180 }) ?? env.attendance.windowDays
    errors.throwIfAny('Paramètres invalides')

    const to = today()
    const from = addDays(to, -(days - 1))

    const children = await childModel.findAll({ status: 'active' })
    const childIds = children.map((child) => child.id)

    // --- Présences ---------------------------------------------------------
    const sheet = await attendanceService.getDailySheet({ date: to }, user)
    const records = await attendanceModel.findMany({ from, to, childIds })
    const attendanceSummary = summarizeAttendance(records)
    const { items: alertItems } = await attendanceService.listAlerts({}, user)

    // --- Progression pédagogique ------------------------------------------
    const goals = await goalModel.findAll({ childIds })
    const activeGoals = goals.filter((goal) => goal.status === 'active')

    const progressByGroup = Object.entries(
      children.reduce((groups, child) => {
        groups[child.group] = groups[child.group] ?? []
        return groups
      }, {}),
    ).map(([group]) => {
      const groupChildIds = new Set(
        children.filter((child) => child.group === group).map((child) => child.id),
      )
      const groupGoals = goals.filter((goal) => groupChildIds.has(goal.childId))

      return {
        group,
        children: groupChildIds.size,
        goals: groupGoals.length,
        averageProgress: averageProgress(groupGoals),
      }
    })

    // --- Séances et comptes-rendus ----------------------------------------
    const sessions = await sessionModel.findAll({ childIds, from, to })
    const upcoming = await sessionModel.findAll({
      childIds,
      from: to,
      to: addDays(to, 7),
      status: 'planned',
    })
    const pending = await reportService.listPending({}, user)

    return {
      generatedAt: new Date().toISOString(),
      period: { from, to, days },

      children: {
        total: children.length,
        byGroup: countBy(children, (child) => child.group),
        byDisability: Object.fromEntries(
          keysOf(DISABILITY_TYPES)
            .map((type) => [type, children.filter((c) => c.disability?.type === type).length])
            .filter(([, count]) => count > 0),
        ),
      },

      attendance: {
        today: sheet.summary,
        period: attendanceSummary,
        presenceRate:
          attendanceSummary.recorded === 0
            ? null
            : Math.round((1 - attendanceSummary.absenceRate) * 100),
        alerts: {
          total: alertItems.length,
          critical: alertItems.filter((item) =>
            item.alerts.some((alert) => alert.severity === 'critical'),
          ).length,
          children: alertItems.slice(0, 10).map((item) => ({
            child: item.child,
            rules: item.alerts.map((alert) => alert.rule),
          })),
        },
      },

      progress: {
        goals: goals.length,
        activeGoals: activeGoals.length,
        byStatus: Object.fromEntries(
          GOAL_STATUS_KEYS.map((status) => [
            status,
            goals.filter((goal) => goal.status === status).length,
          ]),
        ),
        averageProgress: averageProgress(activeGoals),
        byGroup: progressByGroup,
      },

      sessions: {
        period: sessions.length,
        completed: sessions.filter((session) => session.status === 'completed').length,
        cancelled: sessions.filter((session) => session.status === 'cancelled').length,
        upcoming: upcoming.length,
      },

      pendingReports: {
        total: pending.summary.total,
        overdue: pending.summary.overdue,
        items: pending.items.slice(0, 10),
      },
    }
  },
}
