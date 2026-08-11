import { createRepository, runMany } from './repository.js'

/** Activités (Postgres). Une activité est collective : elle porte plusieurs participants. */

const repository = createRepository({ table: 'activities', prefix: 'act' })

export const activityModel = {
  async findAll(filter = {}) {
    let builder = repository.select()

    if (filter.category) builder = builder.eq('category', filter.category)
    if (filter.group) builder = builder.eq('group', filter.group)
    if (filter.from) builder = builder.gte('date', filter.from)
    if (filter.to) builder = builder.lte('date', filter.to)
    // `participant_ids` est un tableau : l'index GIN rend ce test peu couteux.
    if (filter.childId) builder = builder.contains('participant_ids', [filter.childId])

    return runMany(builder.order('date', { ascending: false }), 'activities.findAll')
  },

  findById: (id) => repository.findById(id),
  create: (data) => repository.create(data),
  update: (id, patch) => repository.update(id, patch),
  remove: (id) => repository.remove(id),

  /** Retire un enfant de toutes les activités, quand sa fiche est effacee. */
  async removeParticipant(childId) {
    const activities = await runMany(
      repository.select().contains('participant_ids', [childId]),
      'activities.removeParticipant',
    )

    for (const activity of activities) {
      await repository.update(activity.id, {
        participantIds: activity.participantIds.filter((entry) => entry !== childId),
      })
    }

    return activities.length
  },
}
