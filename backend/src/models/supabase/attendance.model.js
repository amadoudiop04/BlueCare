import { createRepository, runMany, runMaybeOne } from './repository.js'

/** Presences quotidiennes (Postgres). Une ligne = un enfant, un jour. */

const repository = createRepository({ table: 'attendance', prefix: 'att', immutable: ['childId', 'date'] })

function applyFilters(builder, filter) {
  if (filter.date) builder = builder.eq('date', filter.date)
  if (filter.from) builder = builder.gte('date', filter.from)
  if (filter.to) builder = builder.lte('date', filter.to)
  if (filter.status) builder = builder.eq('status', filter.status)
  if (filter.childId) builder = builder.eq('child_id', filter.childId)
  if (filter.childIds) builder = builder.in('child_id', filter.childIds)

  return builder
}

export const attendanceModel = {
  async findOne(childId, date) {
    return runMaybeOne(
      repository.select().eq('child_id', childId).eq('date', date),
      'attendance.findOne',
    )
  },

  async findMany(filter = {}) {
    if (filter.childIds?.length === 0) return []

    return runMany(
      applyFilters(repository.select(), filter).order('date', { ascending: true }),
      'attendance.findMany',
    )
  },

  /**
   * Cree la presence du jour ou met a jour celle qui existe.
   *
   * On lit avant d'ecrire plutot que d'utiliser `upsert` : la contrainte
   * unique porte sur (child_id, date), pas sur l'identifiant. Un upsert
   * remplacerait l'`id` de la ligne existante, alors qu une correction de
   * saisie doit conserver le meme enregistrement.
   */
  async upsert({ childId, date, ...data }) {
    const existing = await this.findOne(childId, date)

    if (existing) return repository.update(existing.id, data)

    return repository.create({ childId, date, ...data })
  },

  async remove(childId, date) {
    const existing = await this.findOne(childId, date)
    if (!existing) return false

    return repository.remove(existing.id)
  },

  removeByChild: (childId) => repository.removeWhere('child_id', childId),
}
