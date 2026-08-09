import { createRepository, runMany, runMaybeOne } from './repository.js'

/** Traitements et traces d'administration (Postgres). */

const medications = createRepository({
  table: 'medications',
  prefix: 'med',
  immutable: ['childId'],
})

const administrations = createRepository({
  table: 'medication_administrations',
  prefix: 'adm',
  immutable: ['medicationId', 'childId', 'date', 'scheduledTime'],
})

export const medicationModel = {
  async findAll(filter = {}) {
    if (filter.childIds?.length === 0) return []

    let builder = medications.select()

    if (filter.childId) builder = builder.eq('child_id', filter.childId)
    if (filter.childIds) builder = builder.in('child_id', filter.childIds)
    if (filter.active !== undefined) builder = builder.eq('active', filter.active)

    // Traitement en cours a une date donnee : commence avant, pas encore fini.
    if (filter.onDate) {
      builder = builder
        .lte('start_date', filter.onDate)
        .or(`end_date.is.null,end_date.gte.${filter.onDate}`)
    }

    return runMany(builder.order('start_date', { ascending: false }), 'medications.findAll')
  },

  findById: (id) => medications.findById(id),
  create: (data) => medications.create(data),
  update: (id, patch) => medications.update(id, patch),
  remove: (id) => medications.remove(id),

  async removeByChild(childId) {
    await administrations.removeWhere('child_id', childId)
    return medications.removeWhere('child_id', childId)
  },
}

export const administrationModel = {
  async findAll(filter = {}) {
    let builder = administrations.select()

    if (filter.medicationId) builder = builder.eq('medication_id', filter.medicationId)
    if (filter.childId) builder = builder.eq('child_id', filter.childId)
    if (filter.date) builder = builder.eq('date', filter.date)
    if (filter.from) builder = builder.gte('date', filter.from)
    if (filter.to) builder = builder.lte('date', filter.to)

    return runMany(
      builder.order('date', { ascending: false }).order('scheduled_time', { ascending: false }),
      'administrations.findAll',
    )
  },

  /** Une prise est identifiee par traitement + jour + horaire prevu. */
  async findOne({ medicationId, date, scheduledTime }) {
    return runMaybeOne(
      administrations
        .select()
        .eq('medication_id', medicationId)
        .eq('date', date)
        .eq('scheduled_time', scheduledTime),
      'administrations.findOne',
    )
  },

  async upsert({ medicationId, date, scheduledTime, ...data }) {
    const existing = await this.findOne({ medicationId, date, scheduledTime })

    if (existing) return administrations.update(existing.id, data)

    return administrations.create({ medicationId, date, scheduledTime, ...data })
  },
}
