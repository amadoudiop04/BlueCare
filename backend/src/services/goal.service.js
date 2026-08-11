import { GOAL_DOMAINS, GOAL_STATUSES, keysOf } from '../constants/domain.js'
import { goalModel } from '../models/goal.model.js'
import { ApiError } from '../utils/ApiError.js'
import { today } from '../utils/dates.js'
import {
  compact,
  createErrors,
  readDate,
  readEnum,
  readInteger,
  readString,
} from '../utils/validate.js'
import { requireChildAccess, scopedChildIds } from './access.service.js'

/**
 * Objectifs pédagogiques personnalises.
 *
 * `progress` (0-100) est le taux d'avancement affiche. Il se met à jour de
 * deux façons : à la main sur l'objectif, ou automatiquement à chaque
 * compte-rendu de séance qui évalué cet objectif (voir `report.service.js`).
 */

const DOMAIN_KEYS = keysOf(GOAL_DOMAINS)
const STATUS_KEYS = keysOf(GOAL_STATUSES)

function normalizeGoalPayload(payload = {}, { partial = false } = {}) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw ApiError.badRequest('Corps de requête invalide')
  }

  const errors = createErrors()
  const provided = (field) => Object.prototype.hasOwnProperty.call(payload, field)
  const shouldRead = (field) => !partial || provided(field)

  const data = {}

  if (shouldRead('title')) {
    data.title = readString(payload.title, 'title', errors, { required: true, max: 160 })
  }
  if (shouldRead('domain')) {
    data.domain = readEnum(payload.domain, DOMAIN_KEYS, 'domain', errors, { required: true })
  }

  if (provided('description')) {
    data.description = readString(payload.description, 'description', errors, { max: 2000 })
  }
  if (provided('baseline')) {
    data.baseline = readString(payload.baseline, 'baseline', errors, { max: 1000 })
  }
  if (provided('successCriteria')) {
    data.successCriteria = readString(payload.successCriteria, 'successCriteria', errors, {
      max: 1000,
    })
  }
  if (provided('startDate')) {
    data.startDate = readDate(payload.startDate, 'startDate', errors)
  }
  if (provided('targetDate')) {
    data.targetDate = readDate(payload.targetDate, 'targetDate', errors)
  }
  if (provided('status')) {
    data.status = readEnum(payload.status, STATUS_KEYS, 'status', errors)
  }
  if (provided('progress')) {
    data.progress = readInteger(payload.progress, 'progress', errors, { min: 0, max: 100 })
  }

  errors.throwIfAny('Objectif invalide')

  return compact(data)
}

/** Un objectif atteint est a 100 %, et inversement : les deux champs restent coherents. */
function reconcileStatusAndProgress(data, current = {}) {
  const status = data.status ?? current.status
  const progress = data.progress ?? current.progress

  if (data.status === 'achieved') {
    return { ...data, progress: 100, achievedAt: current.achievedAt ?? today() }
  }
  if (data.progress === 100 && status === 'active') {
    return { ...data, status: 'achieved', achievedAt: today() }
  }
  if (data.status && data.status !== 'achieved' && current.status === 'achieved') {
    // Reouverture d'un objectif : on efface la date d'atteinte.
    return { ...data, achievedAt: null, progress: progress === 100 ? 99 : progress }
  }

  return data
}

async function requireGoalAccess(user, goalId, { write = false } = {}) {
  const goal = await goalModel.findById(goalId)
  if (!goal) throw ApiError.notFound('Objectif introuvable')

  await requireChildAccess(user, goal.childId, { write })
  return goal
}

export const goalService = {
  async listForChild(childId, query = {}, user) {
    await requireChildAccess(user, childId)

    const errors = createErrors()
    const filter = compact({
      childId,
      status: readEnum(query.status, STATUS_KEYS, 'status', errors),
      domain: readEnum(query.domain, DOMAIN_KEYS, 'domain', errors),
    })
    errors.throwIfAny('Filtres invalides')

    const items = await goalModel.findAll(filter)

    return {
      items,
      summary: {
        total: items.length,
        active: items.filter((goal) => goal.status === 'active').length,
        achieved: items.filter((goal) => goal.status === 'achieved').length,
        averageProgress: averageProgress(items),
      },
    }
  },

  /** Vue transversale : tous les objectifs du périmètre de l'appelant. */
  async list(query = {}, user) {
    const errors = createErrors()
    const status = readEnum(query.status, STATUS_KEYS, 'status', errors)
    const domain = readEnum(query.domain, DOMAIN_KEYS, 'domain', errors)
    errors.throwIfAny('Filtres invalides')

    const childIds = await scopedChildIds(user)

    return goalModel.findAll(compact({ status, domain, childIds }))
  },

  async getById(goalId, user) {
    return requireGoalAccess(user, goalId)
  },

  async create(childId, payload, user) {
    await requireChildAccess(user, childId, { write: true })

    const data = normalizeGoalPayload(payload)

    return goalModel.create({
      childId,
      description: null,
      baseline: null,
      successCriteria: null,
      startDate: today(),
      targetDate: null,
      status: 'active',
      progress: 0,
      achievedAt: null,
      createdBy: user.id,
      ...reconcileStatusAndProgress(data),
    })
  },

  async update(goalId, payload, user) {
    const current = await requireGoalAccess(user, goalId, { write: true })
    const data = normalizeGoalPayload(payload, { partial: true })

    if (data.targetDate && data.targetDate < (data.startDate ?? current.startDate)) {
      throw ApiError.badRequest("L'échéance précède la date de debut", {
        targetDate: ['Doit suivre la date de debut'],
      })
    }

    return goalModel.update(goalId, reconcileStatusAndProgress(data, current))
  },

  async remove(goalId, user) {
    await requireGoalAccess(user, goalId, { write: true })
    await goalModel.remove(goalId)

    return { goalId }
  },
}

export function averageProgress(goals) {
  if (goals.length === 0) return null

  const total = goals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0)
  return Math.round(total / goals.length)
}
