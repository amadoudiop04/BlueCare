/**
 * Helpers de dates au format ISO court (`YYYY-MM-DD`).
 * Tout est calcule en UTC : une presence saisie le matin ne doit pas
 * basculer au jour precedent selon le fuseau du serveur.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const MS_PER_DAY = 86_400_000

/** Valide le format ET l'existence de la date (`2026-02-31` est rejete). */
export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false

  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Heure au format `HH:MM` sur 24 heures. */
export function isTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Decalage en mois en restant sur un jour valide : le 31 mars moins un mois
 * donne le 28 (ou 29) fevrier, pas le 3 mars.
 */
export function addMonths(isoDate, months) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()

  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

/** `2026-08-05` -> `2026-08`, cle de regroupement mensuel. */
export function monthOf(isoDate) {
  return isoDate.slice(0, 7)
}

/** Tous les mois de la periode, bornes incluses : `['2026-03', '2026-04', ...]`. */
export function monthsBetween(from, to) {
  const months = []
  let cursor = monthOf(from)
  const last = monthOf(to)

  // Garde-fou : 10 ans de mois au maximum, pour ne pas boucler sur une borne folle.
  for (let guard = 0; cursor <= last && guard < 120; guard += 1) {
    months.push(cursor)
    cursor = monthOf(addMonths(`${cursor}-01`, 1))
  }

  return months
}

export function daysBetween(from, to) {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / MS_PER_DAY,
  )
}

/**
 * Les dates ISO se comparent comme des chaines (`'2026-01-02' > '2026-01-01'`).
 * On evite donc de construire des objets Date pour trier ou filtrer.
 */
export function compareIsoDates(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Jour de la semaine au format ISO : 1 = lundi ... 7 = dimanche. */
export function isoWeekday(isoDate) {
  const day = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay()
  return day === 0 ? 7 : day
}

/** Samedi ou dimanche : le centre n'accueille pas les enfants. */
export function isWeekend(isoDate) {
  const day = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}

/** `2026-08-05` -> `05/08/2026`, pour les messages d alerte. */
export function formatFrench(isoDate) {
  if (!isIsoDate(isoDate)) return ''
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function ageInYears(birthDate, at = today()) {
  if (!isIsoDate(birthDate) || !isIsoDate(at)) return null

  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [year, month, day] = at.split('-').map(Number)

  const age = year - birthYear
  const beforeBirthday = month < birthMonth || (month === birthMonth && day < birthDay)
  return beforeBirthday ? age - 1 : age
}
