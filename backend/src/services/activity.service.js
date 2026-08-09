import { randomUUID } from 'node:crypto'

import { ACTIVITY_CATEGORIES, keysOf } from '../constants/domain.js'
import { env } from '../config/env.js'
import { activityModel } from '../models/activity.model.js'
import { childModel } from '../models/child.model.js'
import { ApiError } from '../utils/ApiError.js'
import { anonymizeActivity } from '../utils/anonymize.js'
import { today } from '../utils/dates.js'
import {
  compact,
  createErrors,
  readArray,
  readDate,
  readEnum,
  readPagination,
  readString,
} from '../utils/validate.js'
import { assertCanWrite, requireChildAccess, scopedChildIds } from './access.service.js'

/**
 * Activites du centre et galerie par enfant.
 *
 * Une activite est collective. Consultee depuis la fiche d un enfant, elle
 * passe par `anonymizeActivity` : les autres participants n y apparaissent
 * que sous un alias, y compris dans les textes libres.
 */

const CATEGORY_KEYS = keysOf(ACTIVITY_CATEGORIES)

const MEDIA_URL_PATTERN = /^(https?:\/\/|\/)[^\s]+$/

function readMedia(value, errors) {
  if (value === undefined) return undefined

  const list = readArray(value, 'media', errors, { max: 30 })
  if (!list) return undefined

  return list.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return errors.add(`media.${index}`, 'Objet attendu')
    }

    const nested = errors.nested(`media.${index}`)
    const url = readString(entry.url, 'url', nested, { required: true, max: 500 })

    if (url && !MEDIA_URL_PATTERN.test(url)) {
      nested.add('url', 'URL attendue (http(s):// ou chemin absolu)')
    }

    const media = compact({
      id: typeof entry.id === 'string' && entry.id ? entry.id : randomUUID(),
      url,
      caption: readString(entry.caption, 'caption', nested, { max: 300 }),
    })

    errors.merge(nested)
    return media
  })
}

async function readParticipants(value, errors, { required }) {
  const list = readArray(value, 'participantIds', errors, { required, min: 1, max: 60 })
  if (!list) return undefined

  const ids = [...new Set(list)]
  for (const [index, id] of ids.entries()) {
    if (typeof id !== 'string' || id.trim() === '') {
      errors.add(`participantIds.${index}`, 'Identifiant attendu')
    }
  }
  if (errors.count > 0) return undefined

  const found = await childModel.findManyByIds(ids)
  const missing = ids.filter((id) => !found.some((child) => child.id === id))
  if (missing.length > 0) {
    errors.add('participantIds', `Enfants introuvables : ${missing.join(', ')}`)
  }

  return ids
}

async function normalizeActivityPayload(payload = {}, { partial = false } = {}) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw ApiError.badRequest('Corps de requete invalide')
  }

  const errors = createErrors()
  const provided = (field) => Object.prototype.hasOwnProperty.call(payload, field)
  const shouldRead = (field) => !partial || provided(field)

  const data = {}

  if (shouldRead('title')) {
    data.title = readString(payload.title, 'title', errors, { required: true, max: 160 })
  }
  if (shouldRead('category')) {
    data.category = readEnum(payload.category, CATEGORY_KEYS, 'category', errors, {
      required: true,
    })
  }
  if (shouldRead('date')) {
    data.date = readDate(payload.date, 'date', errors, { required: true, notAfter: today() })
  }
  if (shouldRead('participantIds')) {
    data.participantIds = await readParticipants(payload.participantIds, errors, {
      required: !partial,
    })
  }

  if (provided('description')) {
    data.description = readString(payload.description, 'description', errors, { max: 4000 })
  }
  if (provided('group')) data.group = readString(payload.group, 'group', errors, { max: 80 })
  if (provided('location')) {
    data.location = readString(payload.location, 'location', errors, { max: 160 })
  }
  if (provided('media')) data.media = readMedia(payload.media, errors)
  if (provided('createdBy')) {
    data.createdBy = readString(payload.createdBy, 'createdBy', errors, { max: 120 })
  }

  errors.throwIfAny('Activite invalide')

  return compact(data)
}

/**
 * Charge une activite en verifiant le perimetre : il faut suivre au moins un
 * de ses participants. Sans ce controle, un educateur pourrait modifier
 * l'atelier d un autre groupe en connaissant simplement son identifiant.
 */
async function requireActivityAccess(activityId, user, { write = false } = {}) {
  const activity = await activityModel.findById(activityId)
  if (!activity) throw ApiError.notFound('Activite introuvable')

  const scoped = await scopedChildIds(user)
  if (scoped && !activity.participantIds.some((id) => scoped.includes(id))) {
    throw ApiError.forbidden('Cette activite ne concerne aucun enfant de votre perimetre')
  }
  if (write) assertCanWrite(user)

  return activity
}

function readGalleryFilters(query, errors) {
  return compact({
    from: readDate(query.from, 'from', errors),
    to: readDate(query.to, 'to', errors),
    category: readEnum(query.category, CATEGORY_KEYS, 'category', errors),
    group: readString(query.group, 'group', errors, { max: 80 }),
  })
}

export const activityService = {
  /** Vue interne : les participants sont nommes. */
  async list(query = {}, user) {
    const errors = createErrors()
    const filter = readGalleryFilters(query, errors)
    const childId = readString(query.childId, 'childId', errors, { max: 80 })
    errors.throwIfAny('Filtres invalides')

    const { page, pageSize } = readPagination(query)
    const found = await activityModel.findAll(compact({ ...filter, childId }))

    // Une activite n'est visible que si l'appelant suit au moins un participant.
    const scoped = await scopedChildIds(user)
    const all = scoped
      ? found.filter((activity) => activity.participantIds.some((id) => scoped.includes(id)))
      : found

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

  async getById(activityId, user) {
    return requireActivityAccess(activityId, user)
  },

  async create(payload, user) {
    const data = await normalizeActivityPayload(payload)

    // On ne cree une activite que pour des enfants de son perimetre.
    for (const childId of data.participantIds) {
      await requireChildAccess(user, childId, { write: true })
    }

    return activityModel.create({
      description: null,
      group: null,
      location: null,
      media: [],
      createdBy: null,
      ...data,
    })
  },

  async update(activityId, payload, user) {
    await requireActivityAccess(activityId, user, { write: true })
    const data = await normalizeActivityPayload(payload, { partial: true })

    // Ajouter un participant hors perimetre reviendrait a contourner le controle.
    for (const childId of data.participantIds ?? []) {
      await requireChildAccess(user, childId, { write: true })
    }

    return activityModel.update(activityId, data)
  },

  async remove(activityId, user) {
    await requireActivityAccess(activityId, user, { write: true })
    await activityModel.remove(activityId)

    return { activityId }
  },

  /**
   * Galerie d un enfant, anonymisee.
   * Seul l enfant dont on ouvre la fiche est nomme ; les autres participants
   * sont remplaces par un alias propre a chaque activite.
   */
  async getChildGallery(childId, query = {}, user) {
    const child = await requireChildAccess(user, childId)

    const errors = createErrors()
    const filter = readGalleryFilters(query, errors)
    errors.throwIfAny('Filtres invalides')

    const { page, pageSize } = readPagination(query, { defaultPageSize: 12 })
    const all = await activityModel.findAll({ ...filter, childId })
    const start = (page - 1) * pageSize
    const pageItems = all.slice(start, start + pageSize)

    // Un seul chargement des enfants cites, toutes activites confondues.
    const participantIds = [...new Set(pageItems.flatMap((activity) => activity.participantIds))]
    const children = await childModel.findManyByIds(participantIds)

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName },
      items: pageItems.map((activity) =>
        anonymizeActivity(activity, {
          subjectChildId: child.id,
          children,
          salt: env.anonymizationSalt,
        }),
      ),
      pagination: {
        page,
        pageSize,
        total: all.length,
        pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
      },
    }
  },
}
