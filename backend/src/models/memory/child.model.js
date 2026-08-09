import { db, newId, nowIso, snapshot } from './store.js'

/**
 * Acces aux fiches enfants.
 * Le filtrage vit ici : avec une vraie base, il deviendrait une clause WHERE
 * sans que les services aient a changer.
 */

const byName = (a, b) =>
  a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr')

function matches(child, filter) {
  if (filter.status && child.status !== filter.status) return false
  if (filter.group && child.group !== filter.group) return false
  if (filter.disabilityType && child.disability?.type !== filter.disabilityType) return false
  if (filter.ids && !filter.ids.includes(child.id)) return false
  // Perimetre d un educateur : ses groupes uniquement.
  if (filter.groups && !filter.groups.includes(child.group)) return false

  if (filter.search) {
    const haystack = `${child.firstName} ${child.lastName}`.toLowerCase()
    if (!haystack.includes(filter.search.toLowerCase())) return false
  }

  return true
}

export const childModel = {
  async findAll(filter = {}) {
    return [...db.children.values()]
      .filter((child) => matches(child, filter))
      .sort(byName)
      .map(snapshot)
  },

  async findById(id) {
    return snapshot(db.children.get(id))
  },

  async findManyByIds(ids = []) {
    return ids.map((id) => db.children.get(id)).filter(Boolean).map(snapshot)
  },

  /** Sert a refuser deux fiches pour le meme enfant. */
  async findDuplicate({ firstName, lastName, birthDate }, { excludeId } = {}) {
    const match = [...db.children.values()].find(
      (child) =>
        child.id !== excludeId &&
        child.birthDate === birthDate &&
        child.firstName.toLowerCase() === firstName.toLowerCase() &&
        child.lastName.toLowerCase() === lastName.toLowerCase(),
    )
    return snapshot(match)
  },

  async create(data) {
    const timestamp = nowIso()
    const child = { id: newId('chd'), ...data, createdAt: timestamp, updatedAt: timestamp }

    db.children.set(child.id, child)
    return snapshot(child)
  },

  async update(id, patch) {
    const current = db.children.get(id)
    if (!current) return undefined

    const updated = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    }

    db.children.set(id, updated)
    return snapshot(updated)
  },

  async remove(id) {
    return db.children.delete(id)
  },

  /** Groupes reellement utilises, pour alimenter les filtres du front. */
  async listGroups() {
    const groups = new Set([...db.children.values()].map((child) => child.group).filter(Boolean))
    return [...groups].sort((a, b) => a.localeCompare(b, 'fr'))
  },
}
