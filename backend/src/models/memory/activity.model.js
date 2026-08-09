import { compareIsoDates } from '../../utils/dates.js'
import { db, newId, nowIso, snapshot } from './store.js'

/** Acces aux activites. Une activite est collective : elle porte plusieurs participants. */

function matches(activity, filter) {
  if (filter.category && activity.category !== filter.category) return false
  if (filter.group && activity.group !== filter.group) return false
  if (filter.from && activity.date < filter.from) return false
  if (filter.to && activity.date > filter.to) return false
  if (filter.childId && !activity.participantIds.includes(filter.childId)) return false

  return true
}

export const activityModel = {
  async findAll(filter = {}) {
    return [...db.activities.values()]
      .filter((activity) => matches(activity, filter))
      .sort((a, b) => compareIsoDates(b.date, a.date)) // la plus recente en premier
      .map(snapshot)
  },

  async findById(id) {
    return snapshot(db.activities.get(id))
  },

  async create(data) {
    const timestamp = nowIso()
    const activity = { id: newId('act'), ...data, createdAt: timestamp, updatedAt: timestamp }

    db.activities.set(activity.id, activity)
    return snapshot(activity)
  },

  async update(id, patch) {
    const current = db.activities.get(id)
    if (!current) return undefined

    const updated = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    }

    db.activities.set(id, updated)
    return snapshot(updated)
  },

  async remove(id) {
    return db.activities.delete(id)
  },

  /** Retire un enfant de toutes les activites, quand sa fiche est supprimee. */
  async removeParticipant(childId) {
    let updated = 0

    for (const [id, activity] of db.activities) {
      if (!activity.participantIds.includes(childId)) continue

      db.activities.set(id, {
        ...activity,
        participantIds: activity.participantIds.filter((entry) => entry !== childId),
        updatedAt: nowIso(),
      })
      updated += 1
    }

    return updated
  },
}
