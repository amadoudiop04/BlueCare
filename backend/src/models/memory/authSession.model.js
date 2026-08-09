import { newId, nowIso } from '../ids.js'
import { db, snapshot } from './store.js'

/** Sessions de connexion (mémoire). Une ligne = un appareil connecte. */

export const authSessionModel = {
  async create(data) {
    const timestamp = nowIso()
    const session = { id: newId('ses'), ...data, createdAt: timestamp, updatedAt: timestamp }

    db.authSessions.set(session.id, session)
    return snapshot(session)
  },

  /** Le jeton n'est jamais stocke en clair : on cherche par son hachage. */
  async findByTokenHash(tokenHash) {
    return snapshot([...db.authSessions.values()].find((entry) => entry.tokenHash === tokenHash))
  },

  async findById(id) {
    return snapshot(db.authSessions.get(id))
  },

  async listForUser(userId) {
    return [...db.authSessions.values()]
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1))
      .map(snapshot)
  },

  async touch(id, patch = {}) {
    const current = db.authSessions.get(id)
    if (!current) return undefined

    const updated = { ...current, ...patch, id: current.id, updatedAt: nowIso() }
    db.authSessions.set(id, updated)

    return snapshot(updated)
  },

  async remove(id) {
    return db.authSessions.delete(id)
  },

  /** Déconnexion de tous les autres appareils. */
  async removeForUser(userId, { except } = {}) {
    let removed = 0

    for (const [id, entry] of db.authSessions) {
      if (entry.userId !== userId || id === except) continue

      db.authSessions.delete(id)
      removed += 1
    }

    return removed
  },

  /** Menage des sessions expirees, appele à chaque connexion. */
  async removeExpired(now = nowIso()) {
    let removed = 0

    for (const [id, entry] of db.authSessions) {
      if (entry.expiresAt > now) continue

      db.authSessions.delete(id)
      removed += 1
    }

    return removed
  },
}
