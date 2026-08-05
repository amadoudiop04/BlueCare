import { ApiError } from './ApiError.js'
import { isIsoDate, isTime } from './dates.js'

/**
 * Validation des donnees entrantes, sans dependance externe.
 *
 * Chaque lecteur (`readString`, `readDate`...) renvoie la valeur nettoyee,
 * ou `undefined` s'il a signale une erreur. On accumule toutes les erreurs
 * avant de lancer, pour que le formulaire recoive l'ensemble des champs
 * fautifs en une seule reponse 400 :
 *
 *   const errors = createErrors()
 *   const firstName = readString(body.firstName, 'firstName', errors, { required: true })
 *   errors.throwIfAny()
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^[+0-9][0-9\s.\-()]{6,19}$/

export function createErrors(prefix = '') {
  const fields = {}
  const path = (field) => (prefix ? `${prefix}.${field}` : field)

  return {
    add(field, message) {
      const key = path(field)
      fields[key] = fields[key] ?? []
      fields[key].push(message)
      return undefined
    },

    /** Collecteur pour un sous-objet ou un element de tableau : `familyContacts.0.phone`. */
    nested(field) {
      return createErrors(path(field))
    },

    merge(other) {
      for (const [key, messages] of Object.entries(other.toJSON())) {
        fields[key] = [...(fields[key] ?? []), ...messages]
      }
      return this
    },

    get count() {
      return Object.keys(fields).length
    },

    toJSON() {
      return fields
    },

    throwIfAny(message = 'Donnees invalides') {
      if (Object.keys(fields).length > 0) throw ApiError.badRequest(message, fields)
    },
  }
}

const isEmpty = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

export function readString(value, field, errors, { required = false, min = 1, max = 160 } = {}) {
  if (isEmpty(value)) {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }
  if (typeof value !== 'string') return errors.add(field, 'Doit etre une chaine de caracteres')

  const trimmed = value.trim()
  if (trimmed.length < min) return errors.add(field, `Minimum ${min} caracteres`)
  if (trimmed.length > max) return errors.add(field, `Maximum ${max} caracteres`)

  return trimmed
}

export function readEnum(value, allowed, field, errors, { required = false } = {}) {
  if (isEmpty(value)) {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }
  if (!allowed.includes(value)) {
    return errors.add(field, `Valeur attendue parmi : ${allowed.join(', ')}`)
  }
  return value
}

export function readDate(value, field, errors, { required = false, notAfter, notBefore } = {}) {
  if (isEmpty(value)) {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }
  if (!isIsoDate(value)) return errors.add(field, 'Date attendue au format AAAA-MM-JJ')
  if (notAfter && value > notAfter) return errors.add(field, `Ne peut pas depasser le ${notAfter}`)
  if (notBefore && value < notBefore) {
    return errors.add(field, `Ne peut pas preceder le ${notBefore}`)
  }
  return value
}

export function readTime(value, field, errors, { required = false } = {}) {
  if (isEmpty(value)) {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }
  if (!isTime(value)) return errors.add(field, 'Heure attendue au format HH:MM')
  return value
}

export function readEmail(value, field, errors, { required = false } = {}) {
  if (isEmpty(value)) {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }
  const trimmed = String(value).trim()
  if (!EMAIL_PATTERN.test(trimmed)) return errors.add(field, 'Adresse e-mail invalide')
  return trimmed.toLowerCase()
}

export function readPhone(value, field, errors, { required = false } = {}) {
  if (isEmpty(value)) {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }
  const trimmed = String(value).trim()
  if (!PHONE_PATTERN.test(trimmed)) return errors.add(field, 'Numero de telephone invalide')
  return trimmed
}

export function readInteger(value, field, errors, { required = false, min, max } = {}) {
  if (isEmpty(value)) {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return errors.add(field, 'Nombre entier attendu')
  }
  if (min !== undefined && parsed < min) return errors.add(field, `Minimum ${min}`)
  if (max !== undefined && parsed > max) return errors.add(field, `Maximum ${max}`)

  return parsed
}

/** Liste de chaines courtes : points d'attention, groupes, horaires... */
export function readStringArray(value, field, errors, { required = false, max = 20, itemMax = 300 } = {}) {
  const list = readArray(value, field, errors, { required, max })
  if (!list) return undefined

  const items = list
    .map((item, index) => readString(item, `${field}.${index}`, errors, { max: itemMax }))
    .filter(Boolean)

  return items
}

export function readBoolean(value, field, errors, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return errors.add(field, 'Booleen attendu')
}

export function readArray(value, field, errors, { required = false, min = 0, max = 100 } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.add(field, 'Champ obligatoire')
    return undefined
  }
  if (!Array.isArray(value)) return errors.add(field, 'Liste attendue')
  if (value.length < min) {
    return errors.add(field, min === 1 ? 'Au moins un element requis' : `Minimum ${min} elements`)
  }
  if (value.length > max) return errors.add(field, `Maximum ${max} elements`)
  return value
}

/** `?page=2&pageSize=50` -> bornes sures, quoi que contienne la query. */
export function readPagination(query = {}, { defaultPageSize = 20, maxPageSize = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number.parseInt(query.pageSize, 10) || defaultPageSize),
  )
  return { page, pageSize }
}

/** Retire les cles `undefined` : un PATCH ne doit pas ecraser un champ absent. */
export function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))
}
