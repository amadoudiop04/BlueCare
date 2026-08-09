import { SESSION_STATUSES, SESSION_TYPES, keysOf } from '../constants/domain.js'
import { goalModel } from '../models/goal.model.js'
import { reportModel } from '../models/report.model.js'
import { sessionModel } from '../models/session.model.js'
import { userModel } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { addDays, today } from '../utils/dates.js'
import {
  compact,
  createErrors,
  readArray,
  readDate,
  readEnum,
  readPagination,
  readString,
  readTime,
} from '../utils/validate.js'
import { requireChildAccess, scopedChildIds } from './access.service.js'

/** Séances : planification, realisation, historique par enfant. */

const TYPE_KEYS = keysOf(SESSION_TYPES)
const STATUS_KEYS = keysOf(SESSION_STATUSES)

const DEFAULT_HISTORY_DAYS = 180

async function readGoalIds(value, childId, errors) {
  if (value === undefined) return undefined

  const list = readArray(value, 'goalIds', errors, { max: 10 })
  if (!list) return undefined

  const ids = [...new Set(list)]
  const goals = await goalModel.findManyByIds(ids)

  const missing = ids.filter((id) => !goals.some((goal) => goal.id === id))
  if (missing.length > 0) errors.add('goalIds', `Objectifs introuvables : ${missing.join(', ')}`)

  // Un objectif appartient a un enfant : on ne travaille pas celui d'un autre.
  const foreign = goals.filter((goal) => goal.childId !== childId)
  if (foreign.length > 0) {
    errors.add('goalIds', 'Certains objectifs appartiennent a un autre enfant')
  }

  return ids
}

async function normalizeSessionPayload(payload = {}, { partial = false, childId } = {}) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw ApiError.badRequest('Corps de requête invalide')
  }

  const errors = createErrors()
  const provided = (field) => Object.prototype.hasOwnProperty.call(payload, field)
  const shouldRead = (field) => !partial || provided(field)

  const data = {}

  if (shouldRead('date')) {
    // Une séance peut être planifiée dans le futur : pas de borne haute.
    data.date = readDate(payload.date, 'date', errors, { required: true })
  }
  if (shouldRead('type')) {
    data.type = readEnum(payload.type, TYPE_KEYS, 'type', errors, { required: true })
  }
  if (provided('startTime')) data.startTime = readTime(payload.startTime, 'startTime', errors)
  if (provided('endTime')) data.endTime = readTime(payload.endTime, 'endTime', errors)
  if (provided('location')) {
    data.location = readString(payload.location, 'location', errors, { max: 160 })
  }
  if (provided('title')) data.title = readString(payload.title, 'title', errors, { max: 160 })
  if (provided('notes')) data.notes = readString(payload.notes, 'notes', errors, { max: 2000 })
  if (provided('status')) data.status = readEnum(payload.status, STATUS_KEYS, 'status', errors)
  if (provided('goalIds')) data.goalIds = await readGoalIds(payload.goalIds, childId, errors)

  if (provided('educatorId')) {
    const educatorId = readString(payload.educatorId, 'educatorId', errors, { max: 80 })

    if (educatorId && !(await userModel.findById(educatorId))) {
      errors.add('educatorId', 'Utilisateur introuvable')
    }
    data.educatorId = educatorId
  }

  if (data.startTime && data.endTime && data.endTime < data.startTime) {
    errors.add('endTime', "L'heure de fin précède l'heure de debut")
  }
  if (data.status === 'completed' && data.date && data.date > today()) {
    errors.add('status', 'Une séance a venir ne peut pas être marquee réalisée')
  }

  errors.throwIfAny('Séance invalide')

  return compact(data)
}

export async function requireSessionAccess(user, sessionId, { write = false } = {}) {
  const session = await sessionModel.findById(sessionId)
  if (!session) throw ApiError.notFound('Séance introuvable')

  await requireChildAccess(user, session.childId, { write })
  return session
}

export const sessionService = {
  async list(query = {}, user) {
    const errors = createErrors()
    const filter = compact({
      status: readEnum(query.status, STATUS_KEYS, 'status', errors),
      type: readEnum(query.type, TYPE_KEYS, 'type', errors),
      from: readDate(query.from, 'from', errors),
      to: readDate(query.to, 'to', errors),
      educatorId: readString(query.educatorId, 'educatorId', errors, { max: 80 }),
      childIds: await scopedChildIds(user),
    })
    errors.throwIfAny('Filtres invalides')

    const { page, pageSize } = readPagination(query)
    const all = await sessionModel.findAll(filter)
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

  async getById(sessionId, user) {
    const session = await requireSessionAccess(user, sessionId)
    const report = await reportModel.findBySession(sessionId)
    const goals = await goalModel.findManyByIds(session.goalIds ?? [])

    return { ...session, goals, report: report ?? null }
  },

  async create(childId, payload, user) {
    await requireChildAccess(user, childId, { write: true })
    const data = await normalizeSessionPayload(payload, { childId })

    return sessionModel.create({
      childId,
      educatorId: user.id,
      title: null,
      startTime: null,
      endTime: null,
      location: null,
      notes: null,
      goalIds: [],
      status: data.date > today() ? 'planned' : 'completed',
      createdBy: user.id,
      ...data,
    })
  },

  async update(sessionId, payload, user) {
    const current = await requireSessionAccess(user, sessionId, { write: true })
    const data = await normalizeSessionPayload(payload, {
      partial: true,
      childId: current.childId,
    })

    return sessionModel.update(sessionId, data)
  },

  async cancel(sessionId, payload = {}, user) {
    const session = await requireSessionAccess(user, sessionId, { write: true })

    if (await reportModel.findBySession(sessionId)) {
      throw ApiError.conflict('Cette séance a déjà un compte-rendu, elle ne peut plus être annulée')
    }

    const errors = createErrors()
    const reason = readString(payload.reason, 'reason', errors, { max: 500 })
    errors.throwIfAny('Annulation invalide')

    return sessionModel.update(session.id, compact({ status: 'cancelled', cancelReason: reason }))
  },

  async remove(sessionId, user) {
    const session = await requireSessionAccess(user, sessionId, { write: true })

    const report = await reportModel.findBySession(sessionId)
    if (report) {
      throw ApiError.conflict('Supprimez d\'abord le compte-rendu associe a cette séance')
    }

    await sessionModel.remove(session.id)
    return { sessionId }
  },

  /** Historique complet des séances d'un enfant, comptes-rendus inclus. */
  async getChildHistory(childId, query = {}, user) {
    const child = await requireChildAccess(user, childId)

    const errors = createErrors()
    const to = readDate(query.to, 'to', errors) ?? addDays(today(), 365)
    const from = readDate(query.from, 'from', errors) ?? addDays(today(), -DEFAULT_HISTORY_DAYS)
    const status = readEnum(query.status, STATUS_KEYS, 'status', errors)
    errors.throwIfAny('Période invalide')

    const sessions = await sessionModel.findAll(compact({ childId, from, to, status }))
    const reports = await reportModel.findAll({ childId })
    const reportsBySession = new Map(reports.map((report) => [report.sessionId, report]))
    const goals = await goalModel.findAll({ childId })
    const goalsById = new Map(goals.map((goal) => [goal.id, goal]))

    const items = sessions.map((session) => ({
      ...session,
      goals: (session.goalIds ?? [])
        .map((goalId) => goalsById.get(goalId))
        .filter(Boolean)
        .map((goal) => ({ id: goal.id, title: goal.title, domain: goal.domain })),
      report: reportsBySession.get(session.id) ?? null,
    }))

    const completed = items.filter((session) => session.status === 'completed')

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName, group: child.group },
      period: { from, to },
      items,
      summary: {
        total: items.length,
        planned: items.filter((session) => session.status === 'planned').length,
        completed: completed.length,
        cancelled: items.filter((session) => session.status === 'cancelled').length,
        withoutReport: completed.filter((session) => !session.report).length,
      },
    }
  },
}
