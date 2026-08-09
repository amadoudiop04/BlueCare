import { supabase } from '../../config/supabase.js'
import { ApiError } from '../../utils/ApiError.js'
import { logger } from '../../utils/logger.js'
import { newId, nowIso } from '../ids.js'

/**
 * Socle commun aux modèles Supabase.
 *
 * Deux conventions a traduire dans les deux sens :
 *  - Postgres nomme ses colonnes en `snake_case`, le code metier en `camelCase`
 *  - une colonne absente côté base ne doit pas devenir `undefined` côté objet,
 *    ni l'inverse : un PATCH ne transmet que les champs réellement fournis.
 */

const toSnake = (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
const toCamel = (key) => key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase())

/** Objet metier -> ligne Postgres. Les clés `undefined` sont ecartees. */
function toRow(data = {}) {
  const row = {}

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    row[toSnake(key)] = value
  }

  return row
}

/** Ligne Postgres -> objet metier. */
export function fromRow(row) {
  if (!row) return undefined

  const data = {}
  for (const [key, value] of Object.entries(row)) {
    data[toCamel(key)] = value
  }

  return data
}

const fromRows = (rows = []) => rows.map(fromRow)

/**
 * Traduit une erreur PostgREST en erreur applicative.
 *
 * Les contraintes posees dans `schema.sql` doublent des règles déjà vérifiées
 * par les services ; si l'une remonte quand même, c'est un conflit réel
 * (23505 = doublon, 23503 = référence manquante) et non un bug a 500.
 */
function raise(error, context) {
  if (!error) return

  if (error.code === '23505') {
    throw ApiError.conflict('Cette donnée existe déjà')
  }
  if (error.code === '23503') {
    throw ApiError.badRequest('Référence introuvable')
  }

  logger.error(`Supabase [${context}]`, error.message, error.details ?? '')
  throw ApiError.internal("La base de données n'a pas pu traiter la requête")
}

/** Execute une requête PostgREST et rend les lignes converties. */
export async function runMany(builder, context) {
  const { data, error } = await builder
  raise(error, context)
  return fromRows(data ?? [])
}

/** Variante pour une ligne unique : `undefined` si rien ne correspond. */
export async function runMaybeOne(builder, context) {
  const { data, error } = await builder.maybeSingle()
  raise(error, context)
  return fromRow(data ?? undefined)
}

/**
 * Opérations CRUD identiques d'une table a l'autre.
 * Les modèles ajoutent par-dessus leurs filtres et leurs tris.
 */
export function createRepository({ table, prefix, immutable = [] }) {
  const from = () => supabase().from(table)

  return {
    table,
    from,
    select: () => from().select('*'),

    async findById(id) {
      if (!id) return undefined
      return runMaybeOne(from().select('*').eq('id', id), `${table}.findById`)
    },

    async findManyByIds(ids = []) {
      if (ids.length === 0) return []
      return runMany(from().select('*').in('id', ids), `${table}.findManyByIds`)
    },

    async create(data) {
      const timestamp = nowIso()
      const row = toRow({
        id: newId(prefix),
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      return runMaybeOne(from().insert(row).select('*'), `${table}.create`)
    },

    /**
     * Mise à jour partielle. Les colonnes d'identité (`id`, `child_id`...) sont
     * retirées du patch : un objectif ne change jamais d'enfant, et une erreur
     * d'appel ne doit pas pouvoir le déplacer.
     */
    async update(id, patch = {}) {
      const data = { ...patch }
      for (const field of ['id', 'createdAt', ...immutable]) delete data[field]

      if (Object.keys(data).length === 0) return this.findById(id)

      return runMaybeOne(
        from().update(toRow({ ...data, updatedAt: nowIso() })).eq('id', id).select('*'),
        `${table}.update`,
      )
    },

    async remove(id) {
      const { error, count } = await from().delete({ count: 'exact' }).eq('id', id)
      raise(error, `${table}.remove`)
      return (count ?? 0) > 0
    },

    async removeWhere(column, value) {
      const { error, count } = await from().delete({ count: 'exact' }).eq(column, value)
      raise(error, `${table}.removeWhere`)
      return count ?? 0
    },
  }
}

export { raise }
