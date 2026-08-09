import { compareIsoDates } from '../../utils/dates.js'
import { db, newId, nowIso, snapshot } from './store.js'

/**
 * Comptes-rendus de séance.
 * Un compte-rendu par séance : `sessionId` porte cette contrainte, vérifiée
 * par `findBySession` avant toute création.
 */

function matches(report, filter) {
  if (filter.childId && report.childId !== filter.childId) return false
  if (filter.childIds && !filter.childIds.includes(report.childId)) return false
  if (filter.authorId && report.authorId !== filter.authorId) return false
  if (filter.sessionId && report.sessionId !== filter.sessionId) return false
  if (filter.mood && report.mood !== filter.mood) return false
  if (filter.from && report.date < filter.from) return false
  if (filter.to && report.date > filter.to) return false
  if (filter.healthFlagged && !report.healthFlag?.flagged) return false
  if (filter.goalId && !report.goalProgress.some((entry) => entry.goalId === filter.goalId)) {
    return false
  }

  return true
}

export const reportModel = {
  async findAll(filter = {}) {
    return [...db.reports.values()]
      .filter((report) => matches(report, filter))
      .sort((a, b) => compareIsoDates(b.date, a.date))
      .map(snapshot)
  },

  async findById(id) {
    return snapshot(db.reports.get(id))
  },

  async findBySession(sessionId) {
    return snapshot([...db.reports.values()].find((report) => report.sessionId === sessionId))
  },

  async create(data) {
    const timestamp = nowIso()
    const report = { id: newId('rep'), ...data, createdAt: timestamp, updatedAt: timestamp }

    db.reports.set(report.id, report)
    return snapshot(report)
  },

  async update(id, patch) {
    const current = db.reports.get(id)
    if (!current) return undefined

    const updated = {
      ...current,
      ...patch,
      id: current.id,
      sessionId: current.sessionId,
      childId: current.childId,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    }

    db.reports.set(id, updated)
    return snapshot(updated)
  },

  async remove(id) {
    return db.reports.delete(id)
  },

  async removeByChild(childId) {
    let removed = 0

    for (const [id, report] of db.reports) {
      if (report.childId === childId) {
        db.reports.delete(id)
        removed += 1
      }
    }

    return removed
  },
}
