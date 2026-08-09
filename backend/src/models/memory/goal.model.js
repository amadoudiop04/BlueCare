import { compareIsoDates } from '../../utils/dates.js'
import { db, newId, nowIso, snapshot } from './store.js'

/** Objectifs pedagogiques personnalises, rattaches a un enfant. */

function matches(goal, filter) {
  if (filter.childId && goal.childId !== filter.childId) return false
  if (filter.childIds && !filter.childIds.includes(goal.childId)) return false
  if (filter.status && goal.status !== filter.status) return false
  if (filter.domain && goal.domain !== filter.domain) return false

  return true
}

export const goalModel = {
  async findAll(filter = {}) {
    return [...db.goals.values()]
      .filter((goal) => matches(goal, filter))
      .sort((a, b) => compareIsoDates(b.startDate, a.startDate))
      .map(snapshot)
  },

  async findById(id) {
    return snapshot(db.goals.get(id))
  },

  async findManyByIds(ids = []) {
    return ids.map((id) => db.goals.get(id)).filter(Boolean).map(snapshot)
  },

  async create(data) {
    const timestamp = nowIso()
    const goal = { id: newId('goa'), ...data, createdAt: timestamp, updatedAt: timestamp }

    db.goals.set(goal.id, goal)
    return snapshot(goal)
  },

  async update(id, patch) {
    const current = db.goals.get(id)
    if (!current) return undefined

    const updated = {
      ...current,
      ...patch,
      id: current.id,
      childId: current.childId, // un objectif ne change jamais d enfant
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    }

    db.goals.set(id, updated)
    return snapshot(updated)
  },

  async remove(id) {
    return db.goals.delete(id)
  },

  async removeByChild(childId) {
    let removed = 0

    for (const [id, goal] of db.goals) {
      if (goal.childId === childId) {
        db.goals.delete(id)
        removed += 1
      }
    }

    return removed
  },
}
