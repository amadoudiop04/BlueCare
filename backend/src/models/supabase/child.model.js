import { createRepository, fromRow, runMany, runMaybeOne } from './repository.js'

/** Acces aux fiches enfants (Postgres). */

const repository = createRepository({ table: 'children', prefix: 'chd' })

/** Neutralise les caracteres que PostgREST interprete dans un filtre `or`. */
const escapeLike = (value) => value.replace(/[,()*\\%_]/g, ' ').trim()

function applyFilters(builder, filter) {
  if (filter.status) builder = builder.eq('status', filter.status)
  if (filter.group) builder = builder.eq('group', filter.group)
  if (filter.disabilityType) builder = builder.eq('disability->>type', filter.disabilityType)
  if (filter.ids) builder = builder.in('id', filter.ids)
  // Perimetre d un educateur : ses groupes uniquement.
  if (filter.groups) builder = builder.in('group', filter.groups)

  if (filter.search) {
    const needle = escapeLike(filter.search)
    if (needle) {
      builder = builder.or(`first_name.ilike.%${needle}%,last_name.ilike.%${needle}%`)
    }
  }

  return builder
}

export const childModel = {
  async findAll(filter = {}) {
    // Un tableau de filtre vide ne doit rien renvoyer : `in('id', [])` le fait
    // deja, mais on court-circuite pour eviter un aller-retour inutile.
    if (filter.ids?.length === 0 || filter.groups?.length === 0) return []

    const builder = applyFilters(repository.select(), filter)

    return runMany(
      builder.order('last_name', { ascending: true }).order('first_name', { ascending: true }),
      'children.findAll',
    )
  },

  findById: (id) => repository.findById(id),
  findManyByIds: (ids) => repository.findManyByIds(ids),

  /** Sert a refuser deux fiches pour le meme enfant. */
  async findDuplicate({ firstName, lastName, birthDate }, { excludeId } = {}) {
    let builder = repository
      .select()
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .eq('birth_date', birthDate)

    if (excludeId) builder = builder.neq('id', excludeId)

    return runMaybeOne(builder.limit(1), 'children.findDuplicate')
  },

  create: (data) => repository.create(data),
  update: (id, patch) => repository.update(id, patch),
  remove: (id) => repository.remove(id),

  /** Groupes reellement utilises, pour alimenter les filtres du front. */
  async listGroups() {
    const rows = await runMany(repository.from().select('group'), 'children.listGroups')
    const groups = new Set(rows.map((row) => row.group).filter(Boolean))

    return [...groups].sort((a, b) => a.localeCompare(b, 'fr'))
  },
}

export { fromRow }
