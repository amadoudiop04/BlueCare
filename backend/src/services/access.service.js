import {
  READ_ONLY_ROLES,
  ROLES_WITH_FULL_SCOPE,
  ROLES_WITH_MEDICAL_ACCESS,
} from '../constants/roles.js'
import { childModel } from '../models/child.model.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Périmètre des données, par rôle.
 *
 * `authorize` (middleware) dit qui peut appeler une route.
 * Ce service dit sur QUELS enfants elle s'applique — la distinction compte :
 * un éducateur a le droit d'ouvrir une fiche enfant, mais pas n'importe laquelle.
 *
 *   directeur / infirmière : tout le centre
 *   éducateur              : les enfants de ses groupes
 *   famille                : ses propres enfants, en lecture seule
 */

const hasFullScope = (user) => ROLES_WITH_FULL_SCOPE.includes(user.role)

const canReadMedical = (user) => ROLES_WITH_MEDICAL_ACCESS.includes(user.role)

const isReadOnly = (user) => READ_ONLY_ROLES.includes(user.role)

/** Filtre a appliquer aux listes pour n'exposer que le périmètre de l'appelant. */
export function scopeFilter(user) {
  if (hasFullScope(user)) return {}
  if (user.role === 'family') return { ids: user.childIds ?? [] }

  return { groups: user.groups ?? [] }
}

/**
 * Identifiants des enfants visibles par l'appelant.
 * `undefined` signifie « aucune restriction » : c'est ce que les modèles
 * attendent pour ignorer le filtre `childIds`.
 */
export async function scopedChildIds(user) {
  if (hasFullScope(user)) return undefined
  if (user.role === 'family') return user.childIds ?? []

  const children = await childModel.findAll({ groups: user.groups ?? [] })
  return children.map((child) => child.id)
}

function isWithinScope(user, child) {
  if (hasFullScope(user)) return true
  if (user.role === 'family') return (user.childIds ?? []).includes(child.id)

  return (user.groups ?? []).includes(child.group)
}

/**
 * Charge un enfant en vérifiant que l'appelant y a droit.
 *
 * Le 404 est volontairement renvoye avant le contrôle de périmètre, et le 403
 * porte un message neutre : un éducateur ne doit pas pouvoir deviner la
 * composition des autres groupes en testant des identifiants.
 */
export async function requireChildAccess(user, childId, { write = false } = {}) {
  const child = await childModel.findById(childId)
  if (!child) throw ApiError.notFound('Enfant introuvable')

  if (!isWithinScope(user, child)) {
    throw ApiError.forbidden('Cet enfant ne fait pas partie de votre périmètre')
  }
  if (write && isReadOnly(user)) {
    throw ApiError.forbidden('Votre accès\'est en lecture seule')
  }

  return child
}

export function assertCanWrite(user) {
  if (isReadOnly(user)) throw ApiError.forbidden('Votre accès\'est en lecture seule')
}

/**
 * Masque les champs médicaux pour les rôles qui n'y ont pas droit.
 * Le handicap et le plan d'accompagnement restent visibles : ce sont les
 * informations dont un éducateur a besoin pour animer ses séances.
 */
export function redactChild(user, child) {
  if (!child || canReadMedical(user)) return child

  const { referringDoctor, notes, ...rest } = child

  if (user.role === 'family') {
    // Une famille voit son enfant, pas les notes internes de l'équipe.
    return { ...rest, referringDoctor: referringDoctor ?? null }
  }

  return { ...rest, referringDoctor: null, notes }
}

export const redactChildren = (user, children) => children.map((child) => redactChild(user, child))
