import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  evaluateAttendanceAlerts,
  summarizeAttendance,
} from '../src/utils/attendanceAlerts.js'

const OPTIONS = {
  consecutiveThreshold: 3,
  windowDays: 30,
  windowThreshold: 4,
  referenceDate: '2026-08-05',
}

const record = (date, status) => ({ date, status })

const ruleNames = (alerts) => alerts.map((alert) => alert.rule).sort()

describe('evaluateAttendanceAlerts', () => {
  it("ne signale rien quand l enfant est present", () => {
    const alerts = evaluateAttendanceAlerts(
      [record('2026-08-03', 'present'), record('2026-08-04', 'present')],
      OPTIONS,
    )

    assert.deepEqual(alerts, [])
  })

  it("alerte au seuil d absences consecutives", () => {
    const alerts = evaluateAttendanceAlerts(
      [
        record('2026-07-31', 'present'),
        record('2026-08-03', 'absent'),
        record('2026-08-04', 'absent'),
        record('2026-08-05', 'absent'),
      ],
      OPTIONS,
    )

    const consecutive = alerts.find((alert) => alert.rule === 'consecutive-absences')
    assert.ok(consecutive)
    assert.equal(consecutive.count, 3)
    assert.equal(consecutive.severity, 'warning')
    assert.equal(consecutive.since, '2026-08-03')
  })

  it('reste sous le seuil a une absence pres', () => {
    const alerts = evaluateAttendanceAlerts(
      [record('2026-08-04', 'absent'), record('2026-08-05', 'absent')],
      OPTIONS,
    )

    assert.deepEqual(alerts, [])
  })

  it('compte les absences justifiees dans la serie consecutive', () => {
    const alerts = evaluateAttendanceAlerts(
      [
        record('2026-08-03', 'excused'),
        record('2026-08-04', 'absent'),
        record('2026-08-05', 'excused'),
      ],
      OPTIONS,
    )

    assert.equal(ruleNames(alerts).includes('consecutive-absences'), true)
  })

  it('passe en critique au double du seuil', () => {
    const dates = ['07-29', '07-30', '07-31', '08-03', '08-04', '08-05']
    const alerts = evaluateAttendanceAlerts(
      dates.map((day) => record(`2026-${day}`, 'absent')),
      OPTIONS,
    )

    const consecutive = alerts.find((alert) => alert.rule === 'consecutive-absences')
    assert.equal(consecutive.severity, 'critical')
    assert.equal(consecutive.count, 6)
  })

  it('ignore une serie ancienne, hors de la fenetre', () => {
    const alerts = evaluateAttendanceAlerts(
      [
        record('2026-01-12', 'absent'),
        record('2026-01-13', 'absent'),
        record('2026-01-14', 'absent'),
      ],
      OPTIONS,
    )

    assert.deepEqual(alerts, [])
  })

  it('alerte sur des absences non justifiees dispersees', () => {
    const alerts = evaluateAttendanceAlerts(
      [
        record('2026-07-13', 'absent'),
        record('2026-07-17', 'absent'),
        record('2026-07-23', 'absent'),
        record('2026-07-30', 'absent'),
        record('2026-08-05', 'present'),
      ],
      OPTIONS,
    )

    const repeated = alerts.find((alert) => alert.rule === 'repeated-absences')
    assert.ok(repeated)
    assert.equal(repeated.count, 4)
    assert.equal(alerts.some((alert) => alert.rule === 'consecutive-absences'), false)
  })

  it('n inclut pas les absences justifiees dans la regle des absences repetees', () => {
    const alerts = evaluateAttendanceAlerts(
      [
        record('2026-07-13', 'excused'),
        record('2026-07-17', 'excused'),
        record('2026-07-23', 'excused'),
        record('2026-07-30', 'excused'),
        record('2026-08-05', 'present'),
      ],
      OPTIONS,
    )

    assert.equal(alerts.some((alert) => alert.rule === 'repeated-absences'), false)
  })

  it('exclut les absences anterieures a la fenetre glissante', () => {
    const alerts = evaluateAttendanceAlerts(
      [
        record('2026-06-01', 'absent'),
        record('2026-06-02', 'absent'),
        record('2026-07-20', 'absent'),
        record('2026-07-28', 'absent'),
        record('2026-08-05', 'present'),
      ],
      OPTIONS,
    )

    assert.equal(alerts.some((alert) => alert.rule === 'repeated-absences'), false)
  })

  it('accepte un historique vide', () => {
    assert.deepEqual(evaluateAttendanceAlerts([], OPTIONS), [])
  })

  it('ne depend pas de l ordre des enregistrements', () => {
    const records = [
      record('2026-08-05', 'absent'),
      record('2026-08-03', 'absent'),
      record('2026-08-04', 'absent'),
    ]

    const alerts = evaluateAttendanceAlerts(records, OPTIONS)
    assert.equal(alerts[0].since, '2026-08-03')
  })
})

describe('summarizeAttendance', () => {
  it("compte chaque statut et le taux d absence", () => {
    const summary = summarizeAttendance([
      record('2026-08-01', 'present'),
      record('2026-08-02', 'present'),
      record('2026-08-03', 'late'),
      record('2026-08-04', 'absent'),
      record('2026-08-05', 'excused'),
    ])

    assert.equal(summary.recorded, 5)
    assert.equal(summary.present, 2)
    assert.equal(summary.late, 1)
    assert.equal(summary.absences, 2)
    assert.equal(summary.absenceRate, 0.4)
  })

  it('ne divise pas par zero', () => {
    assert.equal(summarizeAttendance([]).absenceRate, 0)
  })
})
