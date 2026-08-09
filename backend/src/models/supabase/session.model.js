import { createRepository, runMany } from './repository.js'

/** Seances (Postgres) : planifiees, realisees ou annulees. */

const repository = createRepository({ table: 'sessions', prefix: 'ses', immutable: ['childId'] })

export const sessionModel = {
  async findAll(filter = {}) {
    if (filter.childIds?.length === 0) return []

    let builder = repository.select()

    if (filter.childId) builder = builder.eq('child_id', filter.childId)
    if (filter.childIds) builder = builder.in('child_id', filter.childIds)
    if (filter.educatorId) builder = builder.eq('educator_id', filter.educatorId)
    if (filter.status) builder = builder.eq('status', filter.status)
    if (filter.type) builder = builder.eq('type', filter.type)
    if (filter.from) builder = builder.gte('date', filter.from)
    if (filter.to) builder = builder.lte('date', filter.to)
    if (filter.goalId) builder = builder.contains('goal_ids', [filter.goalId])

    return runMany(
      builder.order('date', { ascending: false }).order('start_time', { ascending: true, nullsFirst: true }),
      'sessions.findAll',
    )
  },

  findById: (id) => repository.findById(id),
  create: (data) => repository.create(data),
  update: (id, patch) => repository.update(id, patch),
  remove: (id) => repository.remove(id),
  removeByChild: (childId) => repository.removeWhere('child_id', childId),
}
