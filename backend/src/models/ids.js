import { randomUUID } from 'node:crypto'

/**
 * Fabrique d'identifiants, partagee par les deux pilotes.
 *
 * Les identifiants sont préfixes (`chd_`, `ses_`...) : en lisant un log ou une
 * URL, on sait immédiatement de quelle table vient la valeur. C'est aussi
 * pourquoi les clés primaires sont en `text` côté Postgres et non en `uuid`.
 */
export function newId(prefix) {
  return `${prefix}_${randomUUID()}`
}

export function nowIso() {
  return new Date().toISOString()
}
