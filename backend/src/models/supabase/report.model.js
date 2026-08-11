import { createRepository, runMany, runMaybeOne } from './repository.js'

/**
 * Comptes-rendus de séance (Postgres).
 * Un compte-rendu par séance : la contrainte unique sur `session_id` porte
 * la règle, en plus du contrôle fait par le service.
 */

const repository = createRepository({
  table: 'reports',
  prefix: 'rep',
  immutable: ['sessionId', 'childId'],
})

export const reportModel = {
  async findAll(filter = {}) {
    if (filter.childIds?.length === 0) return []

    let builder = repository.select()

    if (filter.childId) builder = builder.eq('child_id', filter.childId)
    if (filter.childIds) builder = builder.in('child_id', filter.childIds)
    if (filter.authorId) builder = builder.eq('author_id', filter.authorId)
    if (filter.sessionId) builder = builder.eq('session_id', filter.sessionId)
    if (filter.mood) builder = builder.eq('mood', filter.mood)
    if (filter.from) builder = builder.gte('date', filter.from)
    if (filter.to) builder = builder.lte('date', filter.to)
    if (filter.healthFlagged) builder = builder.eq('health_flag->>flagged', 'true')
    // `goal_progress` est un tableau JSONB : on teste l'inclusion d'un élément.
    if (filter.goalId) builder = builder.contains('goal_progress', [{ goalId: filter.goalId }])

    return runMany(builder.order('date', { ascending: false }), 'reports.findAll')
  },

  findById: (id) => repository.findById(id),

  async findBySession(sessionId) {
    return runMaybeOne(repository.select().eq('session_id', sessionId), 'reports.findBySession')
  },

  create: (data) => repository.create(data),
  update: (id, patch) => repository.update(id, patch),
  remove: (id) => repository.remove(id),
  removeByChild: (childId) => repository.removeWhere('child_id', childId),
}
