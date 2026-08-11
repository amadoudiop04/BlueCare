import { ATTENDANCE_STATUSES, keysOf } from '../constants/domain.js'
import { env } from '../config/env.js'
import { attendanceModel } from '../models/attendance.model.js'
import { childModel } from '../models/child.model.js'
import { ApiError } from '../utils/ApiError.js'
import { evaluateAttendanceAlerts, summarizeAttendance } from '../utils/attendanceAlerts.js'
import { addDays, today } from '../utils/dates.js'
import {
  compact,
  createErrors,
  readArray,
  readDate,
  readEnum,
  readString,
  readTime,
} from '../utils/validate.js'
import { requireChildAccess, scopeFilter } from './access.service.js'

/**
 * Présences quotidiennes et alertes sur absences répétées.
 *
 * Les alertes ne sont pas stockées : elles sont recalculees à chaque lecture
 * par `evaluateAttendanceAlerts`. Corriger une saisie erronée fait donc
 * disparaître l'alerte qu'elle avait declenchee, sans traitement de rattrapage.
 */

const STATUS_KEYS = keysOf(ATTENDANCE_STATUSES)

/** Profondeur d'historique renvoyee par défaut sur la fiche d'un enfant. */
const DEFAULT_HISTORY_DAYS = 60

const alertOptions = (referenceDate = today()) => ({
  consecutiveThreshold: env.attendance.consecutiveThreshold,
  windowDays: env.attendance.windowDays,
  windowThreshold: env.attendance.windowThreshold,
  referenceDate,
})

function normalizeRecordPayload(payload = {}, errors, { childId, date } = {}) {
  const status = readEnum(payload.status, STATUS_KEYS, 'status', errors, { required: true })

  const record = compact({
    childId: childId ?? readString(payload.childId, 'childId', errors, { required: true, max: 80 }),
    date:
      date ??
      readDate(payload.date, 'date', errors, { required: true, notAfter: today() }),
    status,
    arrivalTime: readTime(payload.arrivalTime, 'arrivalTime', errors, {
      // Un retard sans heure d'arrivee n'apprend rien : on l'exige.
      required: status === 'late',
    }),
    departureTime: readTime(payload.departureTime, 'departureTime', errors),
    reason: readString(payload.reason, 'reason', errors, {
      // Une absence justifiée doit porter son motif, c'est ce qui la distingue.
      required: status === 'excused',
      max: 500,
    }),
    notes: readString(payload.notes, 'notes', errors, { max: 1000 }),
    // A remplacer par l'utilisateur authentifie quand l'auth sera branchee.
    recordedBy: readString(payload.recordedBy, 'recordedBy', errors, { max: 120 }),
  })

  if (record.arrivalTime && record.departureTime && record.departureTime < record.arrivalTime) {
    errors.add('departureTime', "L'heure de depart précède l'heure d'arrivee")
  }

  return record
}

/** Un enfant sorti des effectifs ne doit plus apparaître dans les saisies. */
function assertRecordable(child) {
  if (child.status === 'archived') {
    throw ApiError.conflict(`La fiche de ${child.firstName} ${child.lastName} est archivee`)
  }
}

async function alertsForChild(childId, referenceDate = today()) {
  const from = addDays(referenceDate, -(env.attendance.windowDays - 1))
  const records = await attendanceModel.findMany({ childId, from, to: referenceDate })

  return evaluateAttendanceAlerts(records, alertOptions(referenceDate))
}

export const attendanceService = {
  /**
   * Feuille de présence du jour : tous les enfants accueillis, avec leur
   * saisie si elle existe. Les enfants sans saisie remontent avec
   * `status: null`, ce qui rend les oublis visibles.
   */
  async getDailySheet(query = {}, user) {
    const errors = createErrors()
    const date = readDate(query.date, 'date', errors, { notAfter: today() }) ?? today()
    const group = readString(query.group, 'group', errors, { max: 80 })
    errors.throwIfAny('Filtres invalides')

    const children = await childModel.findAll(
      compact({ group, status: 'active', ...scopeFilter(user) }),
    )
    const records = await attendanceModel.findMany({ date })
    const byChildId = new Map(records.map((record) => [record.childId, record]))

    const entries = children.map((child) => ({
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        group: child.group,
      },
      record: byChildId.get(child.id) ?? null,
    }))

    const counters = { present: 0, late: 0, absent: 0, excused: 0, missing: 0 }
    for (const entry of entries) {
      if (!entry.record) counters.missing += 1
      else counters[entry.record.status] += 1
    }

    return { date, group: group ?? null, entries, summary: { total: entries.length, ...counters } }
  },

  /**
   * Saisie d'une présence (création ou correction).
   * Renvoie l'enregistrement et les alertes que cette saisie laisse actives :
   * l'éducateur voit immédiatement si l'enfant bascule en absences répétées.
   */
  async record(payload = {}, user) {
    const errors = createErrors()
    const data = normalizeRecordPayload(payload, errors)
    errors.throwIfAny('Saisie de présence invalide')

    const child = await requireChildAccess(user, data.childId, { write: true })
    assertRecordable(child)

    const record = await attendanceModel.upsert({ ...data, recordedBy: data.recordedBy ?? user.id })
    const alerts = await alertsForChild(child.id)

    return { record, alerts }
  },

  /**
   * Saisie groupee : la feuille d'appel d'un groupe part en une requête.
   * Rien n'est écrit tant qu'une ligne est invalide, pour ne pas laisser
   * la feuille a moitie saisie.
   */
  async recordMany(payload = {}, user) {
    const errors = createErrors()
    const date = readDate(payload.date, 'date', errors, { required: true, notAfter: today() })
    const rows = readArray(payload.records, 'records', errors, {
      required: true,
      min: 1,
      max: 200,
    })
    errors.throwIfAny('Saisie groupee invalide')

    const normalized = rows.map((row, index) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        return errors.add(`records.${index}`, 'Objet attendu')
      }

      const nested = errors.nested(`records.${index}`)
      const data = normalizeRecordPayload(
        { ...row, recordedBy: row.recordedBy ?? payload.recordedBy ?? user.id },
        nested,
        { date },
      )
      errors.merge(nested)
      return data
    })
    errors.throwIfAny('Saisie groupee invalide')

    // On vérifie tous les enfants et le périmètre avant d'écrire quoi que ce soit.
    const children = await Promise.all(
      normalized.map((data) => requireChildAccess(user, data.childId, { write: true })),
    )
    children.forEach(assertRecordable)

    const seen = new Set()
    for (const data of normalized) {
      if (seen.has(data.childId)) {
        throw ApiError.badRequest('Un enfant apparait deux fois dans la saisie', {
          childId: data.childId,
        })
      }
      seen.add(data.childId)
    }

    const records = []
    for (const data of normalized) {
      records.push(await attendanceModel.upsert(data))
    }

    const alerts = []
    for (const child of children) {
      for (const alert of await alertsForChild(child.id)) {
        alerts.push({ child: { id: child.id, firstName: child.firstName, lastName: child.lastName }, ...alert })
      }
    }

    return { date, records, alerts }
  },

  /** Historique d'un enfant : ses saisies, ses compteurs et ses alertes. */
  async getChildHistory(childId, query = {}, user) {
    const child = await requireChildAccess(user, childId)

    const errors = createErrors()
    const to = readDate(query.to, 'to', errors) ?? today()
    const from = readDate(query.from, 'from', errors) ?? addDays(to, -(DEFAULT_HISTORY_DAYS - 1))
    errors.throwIfAny('Période invalide')

    if (from > to) throw ApiError.badRequest('La date de debut suit la date de fin')

    const records = await attendanceModel.findMany({ childId, from, to })

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName, group: child.group },
      period: { from, to },
      records,
      summary: summarizeAttendance(records),
      alerts: evaluateAttendanceAlerts(records, alertOptions(to)),
    }
  },

  async getChildAlerts(childId, user) {
    const child = await requireChildAccess(user, childId)

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName, group: child.group },
      alerts: await alertsForChild(child.id),
    }
  },

  /**
   * Tableau de bord des alertes : parcourt les enfants accueillis et ne
   * remonte que ceux dont les absences depassent un seuil.
   */
  async listAlerts(query = {}, user) {
    const errors = createErrors()
    const group = readString(query.group, 'group', errors, { max: 80 })
    const severity = readEnum(query.severity, ['warning', 'critical'], 'severity', errors)
    const referenceDate = readDate(query.date, 'date', errors, { notAfter: today() }) ?? today()
    errors.throwIfAny('Filtres invalides')

    const children = await childModel.findAll(
      compact({ group, status: 'active', ...scopeFilter(user) }),
    )
    const from = addDays(referenceDate, -(env.attendance.windowDays - 1))

    // Une seule lecture pour tout le monde, puis regroupement par enfant.
    const records = await attendanceModel.findMany({
      from,
      to: referenceDate,
      childIds: children.map((child) => child.id),
    })

    const byChildId = new Map()
    for (const record of records) {
      if (!byChildId.has(record.childId)) byChildId.set(record.childId, [])
      byChildId.get(record.childId).push(record)
    }

    const items = []
    for (const child of children) {
      const childRecords = byChildId.get(child.id) ?? []
      const alerts = evaluateAttendanceAlerts(childRecords, alertOptions(referenceDate)).filter(
        (alert) => !severity || alert.severity === severity,
      )

      if (alerts.length === 0) continue

      items.push({
        child: {
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          group: child.group,
        },
        alerts,
        summary: summarizeAttendance(childRecords),
      })
    }

    // Les situations critiques d'abord, puis les plus nombreuses.
    const weight = (item) => (item.alerts.some((alert) => alert.severity === 'critical') ? 0 : 1)
    items.sort((a, b) => weight(a) - weight(b) || b.alerts.length - a.alerts.length)

    return {
      period: { from, to: referenceDate },
      rules: {
        consecutiveThreshold: env.attendance.consecutiveThreshold,
        windowDays: env.attendance.windowDays,
        windowThreshold: env.attendance.windowThreshold,
      },
      items,
    }
  },

  /** Annule une saisie erronée (ex. présence enregistrée sur le mauvais enfant). */
  async remove(childId, date, user) {
    await requireChildAccess(user, childId, { write: true })

    const errors = createErrors()
    readDate(date, 'date', errors, { required: true })
    errors.throwIfAny('Date invalide')

    const removed = await attendanceModel.remove(childId, date)
    if (!removed) throw ApiError.notFound('Aucune présence enregistrée pour cette date')

    return { childId, date }
  },
}
