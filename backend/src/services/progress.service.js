import { MOOD_SCORES } from '../constants/domain.js'
import { env } from '../config/env.js'
import { goalModel } from '../models/goal.model.js'
import { reportModel } from '../models/report.model.js'
import { sessionModel } from '../models/session.model.js'
import { ApiError } from '../utils/ApiError.js'
import { addMonths, compareIsoDates, monthOf, monthsBetween, today } from '../utils/dates.js'
import { createErrors, readEnum, readInteger } from '../utils/validate.js'
import { requireChildAccess } from './access.service.js'
import { averageProgress } from './goal.service.js'

/**
 * Séries d'évolution destinees aux graphiques.
 *
 * Les points viennent des comptes-rendus de séance : chaque évaluation d'un
 * objectif produit un point date. On renvoie aussi une agregation mensuelle,
 * car six mois de séances font trop de points pour un graphique lisible, et
 * le front n'a alors aucun calcul a refaire.
 */

const round = (value) => Math.round(value * 10) / 10

/** Moyenne par mois, avec les mois sans séance conservés a `null`. */
function monthlySeries(points, from, to, valueOf) {
  const buckets = new Map()

  for (const point of points) {
    const month = monthOf(point.date)
    if (!buckets.has(month)) buckets.set(month, [])
    buckets.get(month).push(valueOf(point))
  }

  return monthsBetween(from, to).map((month) => {
    const values = buckets.get(month) ?? []

    return {
      month,
      average: values.length === 0 ? null : round(values.reduce((a, b) => a + b, 0) / values.length),
      samples: values.length,
    }
  })
}

function trendOf(points, valueOf) {
  if (points.length === 0) return { start: null, current: null, delta: null }

  const start = valueOf(points[0])
  const current = valueOf(points.at(-1))

  return { start, current, delta: round(current - start) }
}

export const progressService = {
  /**
   * Évolution d'un enfant sur N mois : une série par objectif, plus une
   * série d'humeur, toutes deux prêtes à être tracées.
   */
  async getChildProgress(childId, query = {}, user) {
    const child = await requireChildAccess(user, childId)

    const errors = createErrors()
    const months =
      readInteger(query.months, 'months', errors, { min: 1, max: 24 }) ??
      env.tracking.progressWindowMonths
    const status = readEnum(query.status, ['active', 'achieved', 'paused', 'abandoned'], 'status', errors)
    errors.throwIfAny('Paramètres invalides')

    const to = today()
    const from = addMonths(to, -months)

    const goals = await goalModel.findAll({ childId, ...(status ? { status } : {}) })
    const reports = await reportModel.findAll({ childId, from, to })
    const sessions = await sessionModel.findAll({ childId, from, to, status: 'completed' })

    const sorted = [...reports].sort((a, b) => compareIsoDates(a.date, b.date))

    const series = goals.map((goal) => {
      const points = sorted
        .flatMap((report) => {
          const entry = report.goalProgress?.find((item) => item.goalId === goal.id)
          if (!entry) return []

          return [
            {
              date: report.date,
              progress: entry.progress,
              comment: entry.comment ?? null,
              sessionId: report.sessionId,
              reportId: report.id,
            },
          ]
        })
        .sort((a, b) => compareIsoDates(a.date, b.date))

      return {
        goal: {
          id: goal.id,
          title: goal.title,
          domain: goal.domain,
          status: goal.status,
          progress: goal.progress,
          startDate: goal.startDate,
          targetDate: goal.targetDate,
        },
        points,
        monthly: monthlySeries(points, from, to, (point) => point.progress),
        trend: trendOf(points, (point) => point.progress),
        sessionsWorked: points.length,
      }
    })

    const moodPoints = sorted
      .filter((report) => report.mood in MOOD_SCORES)
      .map((report) => ({
        date: report.date,
        mood: report.mood,
        score: MOOD_SCORES[report.mood],
        sessionId: report.sessionId,
      }))

    return {
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        group: child.group,
      },
      period: { from, to, months },
      goals: series,
      mood: {
        points: moodPoints,
        monthly: monthlySeries(moodPoints, from, to, (point) => point.score),
        trend: trendOf(moodPoints, (point) => point.score),
      },
      summary: {
        goals: goals.length,
        averageProgress: averageProgress(goals),
        sessionsCompleted: sessions.length,
        reports: reports.length,
      },
    }
  },

  /** Série d'un seul objectif, pour un graphique isole. */
  async getGoalProgress(goalId, query = {}, user) {
    const goal = await goalModel.findById(goalId)
    if (!goal) throw ApiError.notFound('Objectif introuvable')

    const progress = await this.getChildProgress(goal.childId, query, user)
    return progress.goals.find((entry) => entry.goal.id === goalId)
  },
}
