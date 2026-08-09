import { createRepository, runMany } from './repository.js'

/** Objectifs pedagogiques (Postgres). */

const repository = createRepository({ table: 'goals', prefix: 'goa', immutable: ['childId'] })

export const goalModel = {
  async findAll(filter = {}) {
    if (filter.childIds?.length === 0) return []

    let builder = repository.select()

    if (filter.childId) builder = builder.eq('child_id', filter.childId)
    if (filter.childIds) builder = builder.in('child_id', filter.childIds)
    if (filter.status) builder = builder.eq('status', filter.status)
    if (filter.domain) builder = builder.eq('domain', filter.domain)

    return runMany(builder.order('start_date', { ascending: false }), 'goals.findAll')
  },

  findById: (id) => repository.findById(id),
  findManyByIds: (ids) => repository.findManyByIds(ids),
  create: (data) => repository.create(data),
  update: (id, patch) => repository.update(id, patch),
  remove: (id) => repository.remove(id),
  removeByChild: (childId) => repository.removeWhere('child_id', childId),
}
