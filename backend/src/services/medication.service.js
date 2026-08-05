import {
  ADMINISTRATION_STATUSES,
  MEDICATION_ROUTES,
  keysOf,
} from '../constants/domain.js'
import { administrationModel, medicationModel } from '../models/medication.model.js'
import { childModel } from '../models/child.model.js'
import { ApiError } from '../utils/ApiError.js'
import { isoWeekday, today } from '../utils/dates.js'
import {
  compact,
  createErrors,
  readArray,
  readBoolean,
  readDate,
  readEnum,
  readString,
  readTime,
} from '../utils/validate.js'
import { requireChildAccess, scopedChildIds } from './access.service.js'

/**
 * Traitements et rappels de medicaments.
 *
 * Donnee medicale : les routes sont reservees a l'infirmiere et a la
 * direction. Chaque prise prevue est tracee, ce qui fait disparaitre le
 * rappel correspondant une fois le medicament donne.
 */

const ROUTE_KEYS = keysOf(MEDICATION_ROUTES)
const ADMINISTRATION_KEYS = keysOf(ADMINISTRATION_STATUSES)

function readSchedule(value, errors, { required }) {
  if (value === undefined) {
    if (required) errors.add('schedule', 'Champ obligatoire')
    return undefined
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return errors.add('schedule', 'Objet attendu')
  }

  const nested = errors.nested('schedule')
  const times = readArray(value.times, 'times', nested, { required: true, min: 1, max: 8 }) ?? []

  const schedule = {
    times: times
      .map((time, index) => readTime(time, `times.${index}`, nested))
      .filter(Boolean)
      .sort(),
    // Vide = tous les jours. Sinon 1 (lundi) a 7 (dimanche).
    days: (readArray(value.days, 'days', nested, { max: 7 }) ?? [])
      .map((day, index) => {
        const parsed = Number(day)
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 7) {
          return nested.add(`days.${index}`, 'Jour attendu entre 1 (lundi) et 7 (dimanche)')
        }
        return parsed
      })
      .filter(Boolean),
  }

  errors.merge(nested)
  return schedule
}

function normalizeMedicationPayload(payload = {}, { partial = false } = {}) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw ApiError.badRequest('Corps de requete invalide')
  }

  const errors = createErrors()
  const provided = (field) => Object.prototype.hasOwnProperty.call(payload, field)
  const shouldRead = (field) => !partial || provided(field)

  const data = {}

  if (shouldRead('name')) {
    data.name = readString(payload.name, 'name', errors, { required: true, max: 160 })
  }
  if (shouldRead('dosage')) {
    data.dosage = readString(payload.dosage, 'dosage', errors, { required: true, max: 120 })
  }
  if (shouldRead('schedule')) {
    data.schedule = readSchedule(payload.schedule, errors, { required: !partial })
  }
  if (shouldRead('startDate')) {
    data.startDate = readDate(payload.startDate, 'startDate', errors, { required: true })
  }

  if (provided('route')) data.route = readEnum(payload.route, ROUTE_KEYS, 'route', errors)
  if (provided('endDate')) data.endDate = readDate(payload.endDate, 'endDate', errors)
  if (provided('prescribedBy')) {
    data.prescribedBy = readString(payload.prescribedBy, 'prescribedBy', errors, { max: 160 })
  }
  if (provided('instructions')) {
    data.instructions = readString(payload.instructions, 'instructions', errors, { max: 2000 })
  }
  if (provided('active')) data.active = readBoolean(payload.active, 'active', errors)

  if (data.endDate && data.startDate && data.endDate < data.startDate) {
    errors.add('endDate', 'La fin du traitement precede son debut')
  }

  errors.throwIfAny('Traitement invalide')

  return compact(data)
}

/** Le traitement est-il prevu ce jour-la ? */
function isScheduledOn(medication, date) {
  if (!medication.active) return false
  if (medication.startDate > date) return false
  if (medication.endDate && medication.endDate < date) return false

  const days = medication.schedule?.days ?? []
  return days.length === 0 || days.includes(isoWeekday(date))
}

async function requireMedication(medicationId) {
  const medication = await medicationModel.findById(medicationId)
  if (!medication) throw ApiError.notFound('Traitement introuvable')
  return medication
}

export const medicationService = {
  async listForChild(childId, query = {}, user) {
    await requireChildAccess(user, childId)

    const active = query.active === undefined ? undefined : query.active !== 'false'
    return medicationModel.findAll(compact({ childId, active }))
  },

  async create(childId, payload, user) {
    await requireChildAccess(user, childId, { write: true })

    const data = normalizeMedicationPayload(payload)

    return medicationModel.create({
      childId,
      route: 'oral',
      endDate: null,
      prescribedBy: null,
      instructions: null,
      active: true,
      createdBy: user.id,
      ...data,
    })
  },

  async update(medicationId, payload, user) {
    const medication = await requireMedication(medicationId)
    await requireChildAccess(user, medication.childId, { write: true })

    return medicationModel.update(medicationId, normalizeMedicationPayload(payload, { partial: true }))
  },

  async remove(medicationId, user) {
    const medication = await requireMedication(medicationId)
    await requireChildAccess(user, medication.childId, { write: true })

    // On desactive : l'historique des prises garde son sens.
    return medicationModel.update(medicationId, { active: false })
  },

  /**
   * Prises attendues pour une journee, avec leur statut.
   * C'est la source des rappels de medicaments du fil de notifications.
   */
  async getDoses(query = {}, user) {
    const errors = createErrors()
    const date = readDate(query.date, 'date', errors) ?? today()
    errors.throwIfAny('Date invalide')

    const childIds = await scopedChildIds(user)
    const medications = await medicationModel.findAll(
      compact({ childIds, active: true, onDate: date }),
    )
    const scheduled = medications.filter((medication) => isScheduledOn(medication, date))

    const children = await childModel.findManyByIds([
      ...new Set(scheduled.map((medication) => medication.childId)),
    ])
    const childById = new Map(children.map((child) => [child.id, child]))

    const administrations = await administrationModel.findAll({ date })
    const key = (medicationId, time) => `${medicationId}:${time}`
    const doneByKey = new Map(
      administrations.map((entry) => [key(entry.medicationId, entry.scheduledTime), entry]),
    )

    const doses = scheduled.flatMap((medication) =>
      (medication.schedule?.times ?? []).map((scheduledTime) => {
        const administration = doneByKey.get(key(medication.id, scheduledTime)) ?? null
        const child = childById.get(medication.childId)

        return {
          medicationId: medication.id,
          name: medication.name,
          dosage: medication.dosage,
          route: medication.route,
          instructions: medication.instructions,
          date,
          scheduledTime,
          status: administration?.status ?? 'pending',
          administration,
          child: child
            ? {
                id: child.id,
                firstName: child.firstName,
                lastName: child.lastName,
                group: child.group,
              }
            : null,
        }
      }),
    )

    doses.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

    return {
      date,
      doses,
      summary: {
        total: doses.length,
        pending: doses.filter((dose) => dose.status === 'pending').length,
        given: doses.filter((dose) => dose.status === 'given').length,
      },
    }
  },

  /** Trace une prise (donnee, refusee ou manquee). */
  async recordAdministration(medicationId, payload = {}, user) {
    const medication = await requireMedication(medicationId)
    await requireChildAccess(user, medication.childId, { write: true })

    const errors = createErrors()
    const date = readDate(payload.date, 'date', errors, { notAfter: today() }) ?? today()
    const scheduledTime = readTime(payload.scheduledTime, 'scheduledTime', errors, {
      required: true,
    })
    const status = readEnum(payload.status, ADMINISTRATION_KEYS, 'status', errors, {
      required: true,
    })
    const notes = readString(payload.notes, 'notes', errors, { max: 1000 })
    const givenAt = readTime(payload.givenAt, 'givenAt', errors)
    errors.throwIfAny('Administration invalide')

    if (!(medication.schedule?.times ?? []).includes(scheduledTime)) {
      throw ApiError.badRequest('Cet horaire ne fait pas partie du traitement', {
        scheduledTime: [`Horaires prevus : ${(medication.schedule?.times ?? []).join(', ')}`],
      })
    }

    return administrationModel.upsert(
      compact({
        medicationId,
        childId: medication.childId,
        date,
        scheduledTime,
        status,
        givenAt,
        notes,
        recordedBy: user.id,
      }),
    )
  },

  async listAdministrations(childId, query = {}, user) {
    await requireChildAccess(user, childId)

    const errors = createErrors()
    const from = readDate(query.from, 'from', errors)
    const to = readDate(query.to, 'to', errors)
    errors.throwIfAny('Periode invalide')

    return administrationModel.findAll(compact({ childId, from, to }))
  },
}

export { isScheduledOn }
