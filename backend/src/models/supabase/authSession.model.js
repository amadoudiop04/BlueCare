import { nowIso } from '../ids.js'
import { createRepository, runMany, runMaybeOne } from './repository.js'

/** Sessions de connexion (Postgres). Une ligne = un appareil connecte. */

const repository = createRepository({
  table: 'auth_sessions',
  prefix: 'ses',
  immutable: ['userId', 'tokenHash'],
})

export const authSessionModel = {
  create: (data) => repository.create(data),

  /** Le jeton n'est jamais stocke en clair : on cherche par son hachage. */
  findByTokenHash: (tokenHash) =>
    runMaybeOne(repository.select().eq('token_hash', tokenHash), 'authSessions.findByTokenHash'),

  findById: (id) => repository.findById(id),

  listForUser: (userId) =>
    runMany(
      repository.select().eq('user_id', userId).order('last_seen_at', { ascending: false }),
      'authSessions.listForUser',
    ),

  touch: (id, patch) => repository.update(id, patch),

  remove: (id) => repository.remove(id),

  async removeForUser(userId, { except } = {}) {
    let builder = repository.from().delete({ count: 'exact' }).eq('user_id', userId)
    if (except) builder = builder.neq('id', except)

    const { count } = await builder
    return count ?? 0
  },

  async removeExpired(now = nowIso()) {
    const { count } = await repository.from().delete({ count: 'exact' }).lt('expires_at', now)
    return count ?? 0
  },
}
