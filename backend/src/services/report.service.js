import { MOODS, keysOf } from '../constants/domain.js'
import { env } from '../config/env.js'
import { goalModel } from '../models/goal.model.js'
import { reportModel } from '../models/report.model.js'
import { sessionModel } from '../models/session.model.js'
import { ApiError } from '../utils/ApiError.js'
import { addDays, daysBetween, today } from '../utils/dates.js'
import {
  compact,
  createErrors,
  readArray,
  readBoolean,
  readDate,
  readEnum,
  readInteger,
  readPagination,
  readString,
  readStringArray,
} from '../utils/validate.js'
import { requireChildAccess, scopedChildIds } from './access.service.js'
import { requireSessionAccess } from './session.service.js'

/**
 * Comptes-rendus de seance : humeur, objectifs travailles, observations,
 * points d'attention.
 *
 * Deposer un compte-rendu a deux effets de bord voulus :
 *  - la seance passe en `completed`
 *  - le taux d'avancement de chaque objectif evalue est mis a jour
 * C'est ce qui alimente les courbes d'evolution sans double saisie.
 */

const MOOD_KEYS = keysOf(MOODS)

function readGoalProgress(value, errors) {
  if (value === undefined) return undefined

  const list = readArray(value, 'goalProgress', errors, { max: 10 })
  if (!list) return undefined

  return list.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return errors.add(`goalProgress.${index}`, 'Objet attendu')
    }

    const nested = errors.nested(`goalProgress.${index}`)
    const goalId = readString(entry.goalId, 'goalId', nested, { required: true, max: 80 })

    const result = compact({
      goalId,
      progress: readInteger(entry.progress, 'progress', nested, {
        required: true,
        min: 0,
        max: 100,
      }),
      comment: readString(entry.comment, 'comment', nested, { max: 1000 }),
      worked: readBoolean(entry.worked, 'worked', nested) ?? true,
    })

    errors.merge(nested)
    return result
  })
}

function readHealthFlag(value, errors) {
  if (value === undefined) return undefined
  if (value === null) return { flagged: false, description: null }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return errors.add('healthFlag', 'Objet attendu')
  }

  const nested = errors.nested('healthFlag')
  const flagged = readBoolean(value.flagged, 'flagged', nested) ?? false
  const description = readString(value.description, 'description', nested, {
    // Signaler sans decrire ne sert a rien a l'infirmiere.
    required: flagged,
    max: 1000,
  })

  errors.merge(nested)
  return { flagged, description: description ?? null }
}

/** Un compte-rendu ne peut evaluer que les objectifs de l'enfant concerne. */
async function assertGoalsBelongToChild(goalProgress = [], childId) {
  if (goalProgress.length === 0) return

  const goals = await goalModel.findManyByIds(goalProgress.map((entry) => entry.goalId))
  const valid = new Set(goals.filter((goal) => goal.childId === childId).map((goal) => goal.id))
  const invalid = goalProgress.filter((entry) => !valid.has(entry.goalId))

  if (invalid.length > 0) {
    throw ApiError.badRequest('Objectifs invalides pour cet enfant', {
      goalProgress: [`Objectifs rejetes : ${invalid.map((entry) => entry.goalId).join(', ')}`],
    })
  }
}

function normalizeReportPayload(payload = {}, { partial = false } = {}) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw ApiError.badRequest('Corps de requete invalide')
  }

  const errors = createErrors()
  const provided = (field) => Object.prototype.hasOwnProperty.call(payload, field)
  const shouldRead = (field) => !partial || provided(field)

  const data = {}

  if (shouldRead('mood')) {
    data.mood = readEnum(payload.mood, MOOD_KEYS, 'mood', errors, { required: true })
  }
  if (shouldRead('observations')) {
    data.observations = readString(payload.observations, 'observations', errors, {
      required: true,
      min: 10,
      max: 5000,
    })
  }
  if (shouldRead('goalProgress')) {
    data.goalProgress = readGoalProgress(payload.goalProgress, errors) ?? []
  }

  if (provided('moodComment')) {
    data.moodComment = readString(payload.moodComment, 'moodComment', errors, { max: 1000 })
  }
  if (provided('attentionPoints')) {
    data.attentionPoints = readStringArray(payload.attentionPoints, 'attentionPoints', errors, {
      max: 10,
      itemMax: 500,
    })
  }
  if (provided('nextSteps')) {
    data.nextSteps = readString(payload.nextSteps, 'nextSteps', errors, { max: 2000 })
  }
  if (provided('healthFlag')) data.healthFlag = readHealthFlag(payload.healthFlag, errors)

  errors.throwIfAny('Compte-rendu invalide')

  return compact(data)
}

/** Reporte sur les objectifs le taux d'avancement releve pendant la seance. */
async function applyGoalProgress(goalProgress = [], childId) {
  const applied = []

  for (const entry of goalProgress) {
    const goal = await goalModel.findById(entry.goalId)
    if (!goal || goal.childId !== childId) continue

    const patch = { progress: entry.progress }
    if (entry.progress === 100 && goal.status === 'active') {
      patch.status = 'achieved'
      patch.achievedAt = today()
    }

    applied.push(await goalModel.update(goal.id, patch))
  }

  return applied
}

export const reportService = {
  /** Depot du compte-rendu d'une seance. Un seul par seance. */
  async createForSession(sessionId, payload, user) {
    const session = await requireSessionAccess(user, sessionId, { write: true })

    if (session.status === 'cancelled') {
      throw ApiError.conflict('Cette seance a ete annulee')
    }
    if (await reportModel.findBySession(sessionId)) {
      throw ApiError.conflict('Cette seance a deja un compte-rendu', { sessionId })
    }
    if (session.date > today()) {
      throw ApiError.conflict('Cette seance n a pas encore eu lieu')
    }

    const data = normalizeReportPayload(payload)
    await assertGoalsBelongToChild(data.goalProgress, session.childId)

    const report = await reportModel.create({
      sessionId,
      childId: session.childId,
      date: session.date,
      authorId: user.id,
      moodComment: null,
      attentionPoints: [],
      nextSteps: null,
      healthFlag: { flagged: false, description: null },
      submittedAt: new Date().toISOString(),
      ...data,
    })

    await sessionModel.update(sessionId, { status: 'completed' })
    const goals = await applyGoalProgress(report.goalProgress, session.childId)

    return { report, goals }
  },

  async getById(reportId, user) {
    const report = await reportModel.findById(reportId)
    if (!report) throw ApiError.notFound('Compte-rendu introuvable')

    await requireChildAccess(user, report.childId)
    return report
  },

  async update(reportId, payload, user) {
    const current = await this.getById(reportId, user)
    await requireChildAccess(user, current.childId, { write: true })

    const data = normalizeReportPayload(payload, { partial: true })
    await assertGoalsBelongToChild(data.goalProgress, current.childId)

    const report = await reportModel.update(reportId, data)
    const goals = data.goalProgress
      ? await applyGoalProgress(data.goalProgress, current.childId)
      : []

    return { report, goals }
  },

  async remove(reportId, user) {
    const report = await this.getById(reportId, user)
    await requireChildAccess(user, report.childId, { write: true })

    await reportModel.remove(reportId)
    return { reportId }
  },

  async list(query = {}, user) {
    const errors = createErrors()
    const filter = compact({
      from: readDate(query.from, 'from', errors),
      to: readDate(query.to, 'to', errors),
      mood: readEnum(query.mood, MOOD_KEYS, 'mood', errors),
      authorId: readString(query.authorId, 'authorId', errors, { max: 80 }),
      healthFlagged: query.healthFlagged === 'true' ? true : undefined,
      childIds: await scopedChildIds(user),
    })
    errors.throwIfAny('Filtres invalides')

    const { page, pageSize } = readPagination(query)
    const all = await reportModel.findAll(filter)
    const start = (page - 1) * pageSize

    return {
      items: all.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total: all.length,
        pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
      },
    }
  },

  /**
   * Comptes-rendus en attente : seances passees, non annulees, sans
   * compte-rendu depose. Au-dela de `REPORT_DUE_DAYS`, elles sont en retard.
   */
  async listPending(query = {}, user) {
    const childIds = await scopedChildIds(user)

    const errors = createErrors()
    const educatorId = readString(query.educatorId, 'educatorId', errors, { max: 80 })
    errors.throwIfAny('Filtres invalides')

    const sessions = await sessionModel.findAll(
      compact({ childIds, educatorId, to: today(), status: undefined }),
    )
    const reports = await reportModel.findAll(compact({ childIds }))
    const reportedSessionIds = new Set(reports.map((report) => report.sessionId))

    const dueDate = addDays(today(), -env.tracking.reportDueDays)

    const items = sessions
      .filter((session) => session.status !== 'cancelled' && !reportedSessionIds.has(session.id))
      .map((session) => ({
        session,
        overdue: session.date < dueDate,
        daysLate: Math.max(0, daysBetween(session.date, today())),
      }))

    return {
      items,
      summary: {
        total: items.length,
        overdue: items.filter((item) => item.overdue).length,
      },
    }
  },
}
