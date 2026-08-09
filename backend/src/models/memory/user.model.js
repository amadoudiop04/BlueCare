import { db, newId, nowIso, snapshot } from './store.js'
import { sanitizeUser } from '../sanitize.js'

/**
 * Comptes utilisateurs.
 *
 * `passwordHash` ne sort jamais du modèle autrement que par `findByEmail`,
 * qui sert uniquement a la connexion. Toutes les autres lectures passent par
 * `sanitize` : le hachage ne peut donc pas fuir dans une réponse HTTP.
 */

const byName = (a, b) =>
  a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr')


function matches(user, filter) {
  if (filter.role && user.role !== filter.role) return false
  if (filter.status && user.status !== filter.status) return false
  if (filter.childId && !(user.childIds ?? []).includes(filter.childId)) return false

  if (filter.search) {
    const haystack = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase()
    if (!haystack.includes(filter.search.toLowerCase())) return false
  }

  return true
}

export const userModel = {
  async findAll(filter = {}) {
    return [...db.users.values()]
      .filter((user) => matches(user, filter))
      .sort(byName)
      .map((user) => sanitizeUser(snapshot(user)))
  },

  async findById(id) {
    return sanitizeUser(snapshot(db.users.get(id)))
  },

  /** Accès'au hachage, réserve a l'authentification et au changement de mot de passe. */
  async findByIdWithSecret(id) {
    return snapshot(db.users.get(id))
  },

  async findByEmailWithSecret(email) {
    const normalized = String(email ?? '').trim().toLowerCase()
    const user = [...db.users.values()].find((entry) => entry.email === normalized)

    return snapshot(user)
  },

  /** Retrouve le compte d'un lien de réinitialisation. Le jeton n'est jamais stocke en clair. */
  async findByResetTokenHash(tokenHash) {
    if (!tokenHash) return undefined

    return snapshot(
      [...db.users.values()].find((user) => user.resetTokenHash === tokenHash),
    )
  },

  async emailExists(email, { excludeId } = {}) {
    const normalized = String(email ?? '').trim().toLowerCase()

    return [...db.users.values()].some(
      (user) => user.email === normalized && user.id !== excludeId,
    )
  },

  async create(data) {
    const timestamp = nowIso()
    const user = {
      id: newId('usr'),
      status: 'active',
      groups: [],
      childIds: [],
      lastLoginAt: null,
      // Double authentification : les mêmes valeurs par défaut que le schéma SQL.
      totpSecret: null,
      totpEnabled: false,
      totpConfirmedAt: null,
      totpLastStep: null,
      recoveryCodes: [],
      mfaFailedAttempts: 0,
      mfaLockedUntil: null,
      resetTokenHash: null,
      resetExpiresAt: null,
      ...data,
      email: data.email.trim().toLowerCase(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    db.users.set(user.id, user)
    return sanitizeUser(snapshot(user))
  },

  async update(id, patch) {
    const current = db.users.get(id)
    if (!current) return undefined

    const updated = {
      ...current,
      ...patch,
      ...(patch.email ? { email: patch.email.trim().toLowerCase() } : {}),
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    }

    db.users.set(id, updated)
    return sanitizeUser(snapshot(updated))
  },

  async remove(id) {
    return db.users.delete(id)
  },

  /** Retire un enfant de tous les rattachements (familles, referents). */
  async detachChild(childId) {
    let updated = 0

    for (const [id, user] of db.users) {
      if (!(user.childIds ?? []).includes(childId)) continue

      db.users.set(id, {
        ...user,
        childIds: user.childIds.filter((entry) => entry !== childId),
        updatedAt: nowIso(),
      })
      updated += 1
    }

    return updated
  },
}

export { sanitizeUser }
