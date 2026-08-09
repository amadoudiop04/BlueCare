import { compareIsoDates } from '../../utils/dates.js'
import { db, newId, nowIso, snapshot } from './store.js'

/**
 * Traitements en cours et traces d'administration.
 *
 * Donnees medicales : l acces est reserve a l infirmiere et a la direction
 * (voir `constants/roles.js`). Les prises sont tracees une par une, ce qui
 * permet aux rappels de disparaitre une fois le medicament donne.
 */

function matches(medication, filter) {
  if (filter.childId && medication.childId !== filter.childId) return false
  if (filter.childIds && !filter.childIds.includes(medication.childId)) return false
  if (filter.active !== undefined && medication.active !== filter.active) return false

  // Traitement en cours a une date donnee.
  if (filter.onDate) {
    if (medication.startDate > filter.onDate) return false
    if (medication.endDate && medication.endDate < filter.onDate) return false
  }

  return true
}

export const medicationModel = {
  async findAll(filter = {}) {
    return [...db.medications.values()]
      .filter((medication) => matches(medication, filter))
      .sort((a, b) => compareIsoDates(b.startDate, a.startDate))
      .map(snapshot)
  },

  async findById(id) {
    return snapshot(db.medications.get(id))
  },

  async create(data) {
    const timestamp = nowIso()
    const medication = { id: newId('med'), ...data, createdAt: timestamp, updatedAt: timestamp }

    db.medications.set(medication.id, medication)
    return snapshot(medication)
  },

  async update(id, patch) {
    const current = db.medications.get(id)
    if (!current) return undefined

    const updated = {
      ...current,
      ...patch,
      id: current.id,
      childId: current.childId,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    }

    db.medications.set(id, updated)
    return snapshot(updated)
  },

  async remove(id) {
    return db.medications.delete(id)
  },

  async removeByChild(childId) {
    let removed = 0

    for (const [id, medication] of db.medications) {
      if (medication.childId === childId) {
        db.medications.delete(id)
        removed += 1
      }
    }

    for (const [id, administration] of db.administrations) {
      if (administration.childId === childId) db.administrations.delete(id)
    }

    return removed
  },
}

export const administrationModel = {
  async findAll(filter = {}) {
    return [...db.administrations.values()]
      .filter((entry) => {
        if (filter.medicationId && entry.medicationId !== filter.medicationId) return false
        if (filter.childId && entry.childId !== filter.childId) return false
        if (filter.date && entry.date !== filter.date) return false
        if (filter.from && entry.date < filter.from) return false
        if (filter.to && entry.date > filter.to) return false
        return true
      })
      .sort((a, b) => compareIsoDates(b.date, a.date) || b.scheduledTime.localeCompare(a.scheduledTime))
      .map(snapshot)
  },

  /** Une prise est identifiee par traitement + jour + horaire prevu. */
  async findOne({ medicationId, date, scheduledTime }) {
    return snapshot(
      [...db.administrations.values()].find(
        (entry) =>
          entry.medicationId === medicationId &&
          entry.date === date &&
          entry.scheduledTime === scheduledTime,
      ),
    )
  },

  async upsert({ medicationId, date, scheduledTime, ...data }) {
    const existing = [...db.administrations.entries()].find(
      ([, entry]) =>
        entry.medicationId === medicationId &&
        entry.date === date &&
        entry.scheduledTime === scheduledTime,
    )

    const timestamp = nowIso()

    if (existing) {
      const [id, current] = existing
      const updated = { ...current, ...data, updatedAt: timestamp }

      db.administrations.set(id, updated)
      return snapshot(updated)
    }

    const entry = {
      id: newId('adm'),
      medicationId,
      date,
      scheduledTime,
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    db.administrations.set(entry.id, entry)
    return snapshot(entry)
  },
}
