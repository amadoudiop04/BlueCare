import { randomUUID } from 'node:crypto'

/**
 * Fabrique d identifiants, partagee par les deux pilotes.
 *
 * Les identifiants sont prefixes (`chd_`, `ses_`...) : en lisant un log ou une
 * URL, on sait immediatement de quelle table vient la valeur. C est aussi
 * pourquoi les cles primaires sont en `text` cote Postgres et non en `uuid`.
 */
export function newId(prefix) {
  return `${prefix}_${randomUUID()}`
}

export function nowIso() {
  return new Date().toISOString()
}
