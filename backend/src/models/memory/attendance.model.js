import { compareIsoDates } from '../../utils/dates.js'
import { attendanceKey, db, newId, nowIso, snapshot } from './store.js'

/** Accès'aux présences quotidiennes. Une ligne = un enfant, un jour. */

function matches(record, filter) {
  if (filter.date && record.date !== filter.date) return false
  if (filter.from && record.date < filter.from) return false
  if (filter.to && record.date > filter.to) return false
  if (filter.status && record.status !== filter.status) return false
  if (filter.childId && record.childId !== filter.childId) return false
  if (filter.childIds && !filter.childIds.includes(record.childId)) return false

  return true
}

export const attendanceModel = {
  async findOne(childId, date) {
    return snapshot(db.attendance.get(attendanceKey(childId, date)))
  },

  async findMany(filter = {}) {
    return [...db.attendance.values()]
      .filter((record) => matches(record, filter))
      .sort((a, b) => compareIsoDates(a.date, b.date))
      .map(snapshot)
  },

  /**
   * Crée la présence du jour ou met à jour celle qui existe : un éducateur
   * qui corrige une saisie ne doit pas créer un doublon pour la même date.
   */
  async upsert({ childId, date, ...data }) {
    const key = attendanceKey(childId, date)
    const current = db.attendance.get(key)
    const timestamp = nowIso()

    const record = current
      ? { ...current, ...data, updatedAt: timestamp }
      : { id: newId('att'), childId, date, ...data, createdAt: timestamp, updatedAt: timestamp }

    db.attendance.set(key, record)
    return snapshot(record)
  },

  async remove(childId, date) {
    return db.attendance.delete(attendanceKey(childId, date))
  },

  async removeByChild(childId) {
    let removed = 0

    for (const [key, record] of db.attendance) {
      if (record.childId === childId) {
        db.attendance.delete(key)
        removed += 1
      }
    }

    return removed
  },
}
