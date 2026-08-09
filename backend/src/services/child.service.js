import { randomUUID } from 'node:crypto'

import {
  CHILD_STATUSES,
  CONTACT_RELATIONSHIPS,
  DISABILITY_TYPES,
  GENDERS,
  keysOf,
} from '../constants/domain.js'
import { activityModel } from '../models/activity.model.js'
import { attendanceModel } from '../models/attendance.model.js'
import { childModel } from '../models/child.model.js'
import { goalModel } from '../models/goal.model.js'
import { medicationModel } from '../models/medication.model.js'
import { reportModel } from '../models/report.model.js'
import { sessionModel } from '../models/session.model.js'
import { userModel } from '../models/user.model.js'
import { redactChild, redactChildren, requireChildAccess, scopeFilter } from './access.service.js'
import { ApiError } from '../utils/ApiError.js'
import { ageInYears, today } from '../utils/dates.js'
import {
  compact,
  createErrors,
  readArray,
  readBoolean,
  readDate,
  readEmail,
  readEnum,
  readPagination,
  readPhone,
  readString,
} from '../utils/validate.js'

/**
 * Fiches individuelles des enfants : informations personnelles, type de
 * handicap, groupe, contacts famille et medecin referent.
 */

const DISABILITY_KEYS = keysOf(DISABILITY_TYPES)
const STATUS_KEYS = keysOf(CHILD_STATUSES)
const GENDER_KEYS = keysOf(GENDERS)
const RELATIONSHIP_KEYS = keysOf(CONTACT_RELATIONSHIPS)

/** Un enfant accueilli au centre a forcement moins de 25 ans. */
const OLDEST_PLAUSIBLE_BIRTH_DATE = () => `${new Date().getUTCFullYear() - 25}-01-01`

function readDisability(value, errors, { required }) {
  if (value === undefined) {
    if (required) errors.add('disability', 'Champ obligatoire')
    return undefined
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return errors.add('disability', 'Objet attendu')
  }

  const nested = errors.nested('disability')
  const disability = compact({
    type: readEnum(value.type, DISABILITY_KEYS, 'type', nested, { required: true }),
    details: readString(value.details, 'details', nested, { max: 1000 }),
    recognizedAt: readDate(value.recognizedAt, 'recognizedAt', nested, { notAfter: today() }),
    supportPlan: readString(value.supportPlan, 'supportPlan', nested, { max: 2000 }),
  })

  errors.merge(nested)
  return disability
}

function readFamilyContacts(value, errors, { required }) {
  if (value === undefined) {
    if (required) errors.add('familyContacts', 'Champ obligatoire')
    return undefined
  }

  const list = readArray(value, 'familyContacts', errors, { required, min: 1, max: 10 })
  if (!list) return undefined

  const contacts = list.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return errors.add(`familyContacts.${index}`, 'Objet attendu')
    }

    const nested = errors.nested(`familyContacts.${index}`)
    const contact = compact({
      id: typeof entry.id === 'string' && entry.id ? entry.id : randomUUID(),
      firstName: readString(entry.firstName, 'firstName', nested, { max: 80 }),
      lastName: readString(entry.lastName, 'lastName', nested, { required: true, max: 80 }),
      relationship: readEnum(entry.relationship, RELATIONSHIP_KEYS, 'relationship', nested, {
        required: true,
      }),
      phone: readPhone(entry.phone, 'phone', nested, { required: true }),
      email: readEmail(entry.email, 'email', nested),
      address: readString(entry.address, 'address', nested, { max: 300 }),
      isPrimary: readBoolean(entry.isPrimary, 'isPrimary', nested) ?? false,
      notes: readString(entry.notes, 'notes', nested, { max: 500 }),
    })

    errors.merge(nested)
    return contact
  })

  if (errors.count > 0) return undefined

  // Un seul contact principal : a defaut d'indication, c est le premier.
  const primaryIndex = contacts.findIndex((contact) => contact.isPrimary)
  return contacts.map((contact, index) => ({
    ...contact,
    isPrimary: index === (primaryIndex === -1 ? 0 : primaryIndex),
  }))
}

function readReferringDoctor(value, errors) {
  if (value === undefined) return undefined
  if (value === null) return null // permet de detacher le medecin referent
  if (typeof value !== 'object' || Array.isArray(value)) {
    return errors.add('referringDoctor', 'Objet attendu')
  }

  const nested = errors.nested('referringDoctor')
  const doctor = compact({
    lastName: readString(value.lastName, 'lastName', nested, { required: true, max: 80 }),
    firstName: readString(value.firstName, 'firstName', nested, { max: 80 }),
    specialty: readString(value.specialty, 'specialty', nested, { max: 120 }),
    facility: readString(value.facility, 'facility', nested, { max: 160 }),
    phone: readPhone(value.phone, 'phone', nested),
    email: readEmail(value.email, 'email', nested),
    address: readString(value.address, 'address', nested, { max: 300 }),
  })

  errors.merge(nested)
  return doctor
}

/**
 * Valide et normalise le corps de la requete.
 * En mode `partial` (PATCH), seuls les champs presents sont controles :
 * un champ absent n est pas efface.
 */
function normalizeChildPayload(payload = {}, { partial = false } = {}) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw ApiError.badRequest('Corps de requete invalide')
  }

  const errors = createErrors()
  const provided = (field) => Object.prototype.hasOwnProperty.call(payload, field)
  const shouldRead = (field) => !partial || provided(field)

  const data = {}

  if (shouldRead('firstName')) {
    data.firstName = readString(payload.firstName, 'firstName', errors, {
      required: true,
      max: 80,
    })
  }
  if (shouldRead('lastName')) {
    data.lastName = readString(payload.lastName, 'lastName', errors, { required: true, max: 80 })
  }
  if (shouldRead('birthDate')) {
    data.birthDate = readDate(payload.birthDate, 'birthDate', errors, {
      required: true,
      notAfter: today(),
      notBefore: OLDEST_PLAUSIBLE_BIRTH_DATE(),
    })
  }
  if (shouldRead('group')) {
    data.group = readString(payload.group, 'group', errors, { required: true, max: 80 })
  }
  if (shouldRead('disability')) {
    data.disability = readDisability(payload.disability, errors, { required: !partial })
  }
  if (shouldRead('familyContacts')) {
    data.familyContacts = readFamilyContacts(payload.familyContacts, errors, { required: !partial })
  }

  if (provided('gender')) data.gender = readEnum(payload.gender, GENDER_KEYS, 'gender', errors)
  if (provided('status')) data.status = readEnum(payload.status, STATUS_KEYS, 'status', errors)
  if (provided('address')) {
    data.address = readString(payload.address, 'address', errors, { max: 300 })
  }
  if (provided('enrolledAt')) {
    data.enrolledAt = readDate(payload.enrolledAt, 'enrolledAt', errors, { notAfter: today() })
  }
  if (provided('referringDoctor')) {
    data.referringDoctor = readReferringDoctor(payload.referringDoctor, errors)
  }
  if (provided('notes')) data.notes = readString(payload.notes, 'notes', errors, { max: 4000 })

  errors.throwIfAny('Fiche enfant invalide')

  return compact(data)
}

/** Champs calcules, jamais stockes : ils resteraient faux le lendemain. */
function withComputed(child) {
  return {
    ...child,
    displayName: `${child.firstName} ${child.lastName}`,
    age: ageInYears(child.birthDate),
  }
}

/** Recupere un enfant ou leve un 404 : mutualise entre les trois domaines. */
async function requireChild(childId) {
  const child = await childModel.findById(childId)
  if (!child) throw ApiError.notFound('Enfant introuvable')
  return child
}

export const childService = {
  async list(query = {}, user) {
    const errors = createErrors()

    // Par defaut on masque les fiches archivees ; `?status=all` les fait revenir.
    const status =
      query.status === 'all'
        ? undefined
        : (readEnum(query.status, STATUS_KEYS, 'status', errors) ?? 'active')

    const filter = compact({
      status,
      search: readString(query.search, 'search', errors, { max: 80 }),
      group: readString(query.group, 'group', errors, { max: 80 }),
      disabilityType: readEnum(query.disabilityType, DISABILITY_KEYS, 'disabilityType', errors),
      // Le perimetre de l'appelant s'ajoute aux filtres demandes, il ne s y substitue pas.
      ...scopeFilter(user),
    })
    errors.throwIfAny('Filtres invalides')

    const { page, pageSize } = readPagination(query)
    const all = await childModel.findAll(filter)
    const start = (page - 1) * pageSize

    return {
      items: redactChildren(user, all.slice(start, start + pageSize).map(withComputed)),
      pagination: {
        page,
        pageSize,
        total: all.length,
        pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
      },
    }
  },

  async getById(childId, user) {
    return redactChild(user, withComputed(await requireChildAccess(user, childId)))
  },

  async create(payload) {
    const data = normalizeChildPayload(payload)

    const duplicate = await childModel.findDuplicate(data)
    if (duplicate) {
      throw ApiError.conflict('Une fiche existe deja pour cet enfant', {
        childId: duplicate.id,
      })
    }

    const child = await childModel.create({
      status: 'active',
      enrolledAt: today(),
      referringDoctor: null,
      ...data,
    })

    return withComputed(child)
  },

  async update(childId, payload, user) {
    const current = await requireChildAccess(user, childId, { write: true })
    const data = normalizeChildPayload(payload, { partial: true })

    const identity = {
      firstName: data.firstName ?? current.firstName,
      lastName: data.lastName ?? current.lastName,
      birthDate: data.birthDate ?? current.birthDate,
    }
    const duplicate = await childModel.findDuplicate(identity, { excludeId: childId })
    if (duplicate) {
      throw ApiError.conflict('Une autre fiche porte deja cette identite', {
        childId: duplicate.id,
      })
    }

    return redactChild(user, withComputed(await childModel.update(childId, data)))
  },

  /**
   * Sortie d un enfant : on archive au lieu de supprimer, pour conserver
   * l historique de presences et de suivi.
   */
  async archive(childId) {
    await requireChild(childId)
    return withComputed(await childModel.update(childId, { status: 'archived' }))
  },

  /**
   * Effacement definitif (droit a l effacement) : la fiche, ses presences
   * et sa participation aux activites disparaissent. Irreversible.
   */
  async purge(childId) {
    await requireChild(childId)

    const removedAttendance = await attendanceModel.removeByChild(childId)
    const updatedActivities = await activityModel.removeParticipant(childId)
    const removedGoals = await goalModel.removeByChild(childId)
    const removedSessions = await sessionModel.removeByChild(childId)
    const removedReports = await reportModel.removeByChild(childId)
    const removedMedications = await medicationModel.removeByChild(childId)
    await userModel.detachChild(childId)
    await childModel.remove(childId)

    return {
      childId,
      removedAttendance,
      updatedActivities,
      removedGoals,
      removedSessions,
      removedReports,
      removedMedications,
    }
  },

  async listGroups() {
    return childModel.listGroups()
  },
}
