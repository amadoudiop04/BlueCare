import { createRepository, runMany, runMaybeOne } from './repository.js'
import { sanitizeUser } from '../sanitize.js'

/**
 * Comptes utilisateurs (Postgres).
 *
 * `passwordHash` ne sort du modèle que par les deux lectures `...WithSecret`,
 * réservées a la connexion et au changement de mot de passe. Toutes les autres
 * passent par `sanitizeUser` : le hachage ne peut pas fuir dans une réponse HTTP.
 */

const repository = createRepository({ table: 'users', prefix: 'usr' })


const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()

export const userModel = {
  async findAll(filter = {}) {
    let builder = repository.select()

    if (filter.role) builder = builder.eq('role', filter.role)
    if (filter.status) builder = builder.eq('status', filter.status)
    if (filter.childId) builder = builder.contains('child_ids', [filter.childId])

    if (filter.search) {
      const needle = filter.search.replace(/[,()*\\%_]/g, ' ').trim()
      if (needle) {
        builder = builder.or(
          `first_name.ilike.%${needle}%,last_name.ilike.%${needle}%,email.ilike.%${needle}%`,
        )
      }
    }

    const users = await runMany(
      builder.order('last_name', { ascending: true }).order('first_name', { ascending: true }),
      'users.findAll',
    )

    return users.map(sanitizeUser)
  },

  async findById(id) {
    return sanitizeUser(await repository.findById(id))
  },

  findByIdWithSecret: (id) => repository.findById(id),

  async findByEmailWithSecret(email) {
    return runMaybeOne(
      repository.select().eq('email', normalizeEmail(email)).limit(1),
      'users.findByEmail',
    )
  },

  /** Retrouve le compte d'un lien de réinitialisation. Le jeton n'est jamais stocke en clair. */
  async findByResetTokenHash(tokenHash) {
    if (!tokenHash) return undefined

    return runMaybeOne(
      repository.select().eq('reset_token_hash', tokenHash).limit(1),
      'users.findByResetToken',
    )
  },

  async emailExists(email, { excludeId } = {}) {
    let builder = repository.select().eq('email', normalizeEmail(email))
    if (excludeId) builder = builder.neq('id', excludeId)

    return Boolean(await runMaybeOne(builder.limit(1), 'users.emailExists'))
  },

  async create(data) {
    const user = await repository.create({
      status: 'active',
      groups: [],
      childIds: [],
      lastLoginAt: null,
      totpEnabled: false,
      recoveryCodes: [],
      mfaFailedAttempts: 0,
      ...data,
      email: normalizeEmail(data.email),
    })

    return sanitizeUser(user)
  },

  async update(id, patch) {
    const data = { ...patch }
    if (data.email) data.email = normalizeEmail(data.email)

    return sanitizeUser(await repository.update(id, data))
  },

  remove: (id) => repository.remove(id),

  /** Retire un enfant de tous les rattachements (familles, referents). */
  async detachChild(childId) {
    const attached = await runMany(
      repository.select().contains('child_ids', [childId]),
      'users.detachChild',
    )

    for (const user of attached) {
      await repository.update(user.id, {
        childIds: user.childIds.filter((entry) => entry !== childId),
      })
    }

    return attached.length
  },
}

export { sanitizeUser }
