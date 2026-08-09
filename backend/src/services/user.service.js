import { ROLE_KEYS, USER_STATUSES } from '../constants/roles.js'
import { childModel } from '../models/child.model.js'
import { userModel } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { hashPassword } from '../utils/password.js'
import {
  compact,
  createErrors,
  readArray,
  readEmail,
  readEnum,
  readPagination,
  readString,
} from '../utils/validate.js'
import { assertPasswordPolicy } from './auth.service.js'

/** Gestion des comptes. Reservee au directeur (voir `user.routes.js`). */

const STATUS_KEYS = Object.keys(USER_STATUSES)

async function readScope(payload, role, errors, { partial }) {
  const scope = {}

  // Un educateur travaille sur des groupes, une famille sur des enfants
  // nommes. Les deux autres roles voient tout le centre : pas de perimetre.
  if (role === 'educator' && (!partial || payload.groups !== undefined)) {
    const groups = readArray(payload.groups, 'groups', errors, { max: 20 }) ?? []
    scope.groups = groups
      .map((group, index) => readString(group, `groups.${index}`, errors, { max: 80 }))
      .filter(Boolean)
  }

  if (role === 'family' && (!partial || payload.childIds !== undefined)) {
    const childIds = readArray(payload.childIds, 'childIds', errors, {
      required: !partial,
      min: 1,
      max: 10,
    })

    if (childIds) {
      const found = await childModel.findManyByIds(childIds)
      const missing = childIds.filter((id) => !found.some((child) => child.id === id))

      if (missing.length > 0) {
        errors.add('childIds', `Enfants introuvables : ${missing.join(', ')}`)
      }
      scope.childIds = childIds
    }
  }

  return scope
}

export const userService = {
  async list(query = {}) {
    const errors = createErrors()
    const filter = compact({
      role: readEnum(query.role, ROLE_KEYS, 'role', errors),
      status: readEnum(query.status, STATUS_KEYS, 'status', errors),
      search: readString(query.search, 'search', errors, { max: 80 }),
      childId: readString(query.childId, 'childId', errors, { max: 80 }),
    })
    errors.throwIfAny('Filtres invalides')

    const { page, pageSize } = readPagination(query)
    const all = await userModel.findAll(filter)
    const start = (page - 1) * pageSize

    return {
      items: all.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total: all.length,
        pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
      },
    }
  },

  async getById(userId) {
    const user = await userModel.findById(userId)
    if (!user) throw ApiError.notFound('Utilisateur introuvable')
    return user
  },

  async create(payload = {}) {
    const errors = createErrors()

    const email = readEmail(payload.email, 'email', errors, { required: true })
    const role = readEnum(payload.role, ROLE_KEYS, 'role', errors, { required: true })
    const firstName = readString(payload.firstName, 'firstName', errors, {
      required: true,
      max: 80,
    })
    const lastName = readString(payload.lastName, 'lastName', errors, { required: true, max: 80 })
    const phone = readString(payload.phone, 'phone', errors, { max: 40 })
    assertPasswordPolicy(payload.password, 'password', errors)

    const scope = await readScope(payload, role, errors, { partial: false })
    errors.throwIfAny('Compte invalide')

    if (await userModel.emailExists(email)) {
      throw ApiError.conflict('Cette adresse e-mail est deja utilisee')
    }

    return userModel.create(
      compact({
        email,
        role,
        firstName,
        lastName,
        phone,
        passwordHash: await hashPassword(payload.password),
        ...scope,
      }),
    )
  },

  async update(userId, payload = {}) {
    const current = await this.getById(userId)
    const errors = createErrors()

    const email = readEmail(payload.email, 'email', errors)
    const role = readEnum(payload.role, ROLE_KEYS, 'role', errors)
    const data = compact({
      email,
      role,
      firstName: readString(payload.firstName, 'firstName', errors, { max: 80 }),
      lastName: readString(payload.lastName, 'lastName', errors, { max: 80 }),
      phone: readString(payload.phone, 'phone', errors, { max: 40 }),
      status: readEnum(payload.status, STATUS_KEYS, 'status', errors),
    })

    const scope = await readScope(payload, role ?? current.role, errors, { partial: true })
    errors.throwIfAny('Compte invalide')

    if (email && (await userModel.emailExists(email, { excludeId: userId }))) {
      throw ApiError.conflict('Cette adresse e-mail est deja utilisee')
    }

    return userModel.update(userId, { ...data, ...scope })
  },

  /** Reinitialisation par le directeur : l ancien mot de passe n est pas demande. */
  async resetPassword(userId, payload = {}) {
    await this.getById(userId)

    const errors = createErrors()
    assertPasswordPolicy(payload.password, 'password', errors)
    errors.throwIfAny('Mot de passe invalide')

    await userModel.update(userId, { passwordHash: await hashPassword(payload.password) })

    return { userId, reset: true }
  },

  /**
   * Desactivation plutot que suppression : les comptes-rendus deja signes
   * gardent un auteur identifiable.
   */
  async disable(userId, currentUser) {
    if (userId === currentUser.id) {
      throw ApiError.conflict('Vous ne pouvez pas desactiver votre propre compte')
    }

    await this.getById(userId)
    return userModel.update(userId, { status: 'disabled' })
  },
}
