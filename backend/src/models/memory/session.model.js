import { compareIsoDates } from '../../utils/dates.js'
import { db, newId, nowIso, snapshot } from './store.js'

/** Séances : planifiées, réalisées ou annulées. */

function matches(session, filter) {
  if (filter.childId && session.childId !== filter.childId) return false
  if (filter.childIds && !filter.childIds.includes(session.childId)) return false
  if (filter.educatorId && session.educatorId !== filter.educatorId) return false
  if (filter.status && session.status !== filter.status) return false
  if (filter.type && session.type !== filter.type) return false
  if (filter.from && session.date < filter.from) return false
  if (filter.to && session.date > filter.to) return false
  if (filter.goalId && !session.goalIds.includes(filter.goalId)) return false

  return true
}

export const sessionModel = {
  async findAll(filter = {}) {
    return [...db.sessions.values()]
      .filter((session) => matches(session, filter))
      .sort((a, b) => compareIsoDates(b.date, a.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
      .map(snapshot)
  },

  async findById(id) {
    return snapshot(db.sessions.get(id))
  },

  async create(data) {
    const timestamp = nowIso()
    const session = { id: newId('ses'), ...data, createdAt: timestamp, updatedAt: timestamp }

    db.sessions.set(session.id, session)
    return snapshot(session)
  },

  async update(id, patch) {
    const current = db.sessions.get(id)
    if (!current) return undefined

    const updated = {
      ...current,
      ...patch,
      id: current.id,
      childId: current.childId,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    }

    db.sessions.set(id, updated)
    return snapshot(updated)
  },

  async remove(id) {
    return db.sessions.delete(id)
  },

  async removeByChild(childId) {
    let removed = 0

    for (const [id, session] of db.sessions) {
      if (session.childId === childId) {
        db.sessions.delete(id)
        removed += 1
      }
    }

    return removed
  },
}
