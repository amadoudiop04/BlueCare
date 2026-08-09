/** Formatage partage par les écrans. Aucune dépendance, aucun React. */

const MONTHS_SHORT = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

/** `2026-08-06` -> `06/08/2026`. */
export function formatDate(isoDate) {
  if (typeof isoDate !== 'string' || isoDate.length < 10) return '—'
  const [year, month, day] = isoDate.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/** `2026-08-06` -> `{ day: '06', month: 'Août' }`, pour les pastilles de date. */
export function splitDate(isoDate) {
  if (typeof isoDate !== 'string' || isoDate.length < 10) return { day: '--', month: '' }
  const [, month, day] = isoDate.slice(0, 10).split('-')
  return { day, month: MONTHS_SHORT[Number(month) - 1] ?? '' }
}

/** `2026-03` -> `Mars`, pour les axes de graphique. */
export function monthLabel(month) {
  if (typeof month !== 'string') return ''
  return MONTHS_SHORT[Number(month.slice(5, 7)) - 1] ?? month
}

export function initials(firstName = '', lastName = '') {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '??'
}


export const percent = (value) => (value === null || value === undefined ? '—' : `${Math.round(value)}%`)

/** Couleur d'une barre de progression selon le niveau atteint. */
export function progressTone(value = 0) {
  if (value > 70) return { bar: '#14866B', avatar: '#14866B' }
  if (value > 45) return { bar: '#1E5FD8', avatar: '#1E5FD8' }
  return { bar: '#C77A0A', avatar: '#6C9BF0' }
}

/** Les 5 jours ouvres de la semaine contenant `isoDate`. */
export function weekDays(isoDate) {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay()
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() - (weekday - 1))

  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday)
    day.setUTCDate(monday.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
}

export const todayIso = () => new Date().toISOString().slice(0, 10)
