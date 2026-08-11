import { ABSENCE_STATUSES } from '../constants/domain.js'
import { addDays, compareIsoDates, daysBetween, formatFrench, today } from './dates.js'

/**
 * Moteur d'alertes sur les absences répétées.
 *
 * Fonction pure : elle reçoit des enregistrements de présence et rend des
 * alertes. Aucune alerte n'est stockée en base — elles sont recalculees a
 * chaque lecture, ce qui évite les alertes fantomes quand un éducateur
 * corrige une saisie après coup.
 *
 * Deux règles :
 *  - `consecutive-absences`  : l'enfant enchaine les absences (justifiées ou non),
 *                              signe d'une rupture d'accueil a traiter vite.
 *  - `repeated-absences`     : trop d'absences NON justifiées sur une fenêtre
 *                              glissante, même si elles sont dispersees.
 */

const ABSENCE = new Set(ABSENCE_STATUSES)

const byDateAsc = (a, b) => compareIsoDates(a.date, b.date)

/** Une alerte passe en `critical` quand elle atteint le double du seuil. */
const severityFor = (count, threshold) => (count >= threshold * 2 ? 'critical' : 'warning')

/**
 * Série d'absences en fin d'historique, c'est-a-dire celle qui est encore
 * en cours. Une série ancienne, déjà suivie et cloturee, n'a plus a alerter.
 */
function trailingAbsenceStreak(sortedRecords) {
  const streak = []

  for (let index = sortedRecords.length - 1; index >= 0; index -= 1) {
    if (!ABSENCE.has(sortedRecords[index].status)) break
    streak.unshift(sortedRecords[index])
  }

  return streak
}

export function evaluateAttendanceAlerts(records = [], options = {}) {
  const {
    consecutiveThreshold = 3,
    windowDays = 30,
    windowThreshold = 4,
    referenceDate = today(),
  } = options

  const sorted = [...records].sort(byDateAsc)
  const alerts = []

  const streak = trailingAbsenceStreak(sorted)
  const lastAbsence = streak.at(-1)

  // La série doit toucher la période courante : un enfant parti il y a six mois
  // ne doit pas remonter indefiniment dans les alertes du jour.
  const streakIsCurrent = lastAbsence && daysBetween(lastAbsence.date, referenceDate) <= windowDays

  if (streak.length >= consecutiveThreshold && streakIsCurrent) {
    alerts.push({
      rule: 'consecutive-absences',
      severity: severityFor(streak.length, consecutiveThreshold),
      threshold: consecutiveThreshold,
      count: streak.length,
      since: streak[0].date,
      dates: streak.map((record) => record.date),
      message:
        `Absent sur les ${streak.length} derniers jours d accueil enregistres, ` +
        `depuis le ${formatFrench(streak[0].date)} (seuil : ${consecutiveThreshold}).`,
    })
  }

  const windowStart = addDays(referenceDate, -(windowDays - 1))
  const inWindow = sorted.filter(
    (record) => record.date >= windowStart && record.date <= referenceDate,
  )
  const unjustified = inWindow.filter((record) => record.status === 'absent')

  if (unjustified.length >= windowThreshold) {
    alerts.push({
      rule: 'repeated-absences',
      severity: severityFor(unjustified.length, windowThreshold),
      threshold: windowThreshold,
      count: unjustified.length,
      windowDays,
      since: windowStart,
      dates: unjustified.map((record) => record.date),
      message:
        `${unjustified.length} absences non justifiees sur les ${windowDays} derniers jours ` +
        `(seuil : ${windowThreshold}).`,
    })
  }

  return alerts
}

/** Compteurs affichés sur la fiche de l'enfant, a côté de son historique. */
export function summarizeAttendance(records = []) {
  const counters = { present: 0, late: 0, absent: 0, excused: 0 }

  for (const record of records) {
    if (record.status in counters) counters[record.status] += 1
  }

  const recorded = records.length
  const absences = counters.absent + counters.excused

  return {
    recorded,
    ...counters,
    absences,
    absenceRate: recorded === 0 ? 0 : Math.round((absences / recorded) * 100) / 100,
  }
}
