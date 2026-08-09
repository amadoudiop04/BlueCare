import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createChildDirect, createUserWithToken, startTestServer } from './helpers.js'
import { addDays, today } from '../src/utils/dates.js'

/** Tableau de bord, notifications, rappels de medicaments et export PDF. */

let context
let api
let director
let nurse
let educator
let child

before(async () => {
  context = await startTestServer()
  api = context.api

  child = await createChildDirect({ group: 'Les Coquelicots' })
  director = await createUserWithToken(api, { role: 'director' })
  nurse = await createUserWithToken(api, { role: 'nurse' })
  educator = await createUserWithToken(api, { role: 'educator', groups: ['Les Coquelicots'] })
})

after(() => context?.close())

describe('Tableau de bord', () => {
  it('agrege presences, progression et rapports en attente', async () => {
    await api('/attendance', {
      method: 'POST',
      token: educator.token,
      body: { childId: child.id, date: today(), status: 'present', arrivalTime: '08:45' },
    })
    await api(`/children/${child.id}/goals`, {
      method: 'POST',
      token: educator.token,
      body: { title: 'Objectif tableau de bord', domain: 'social', progress: 40 },
    })
    await api(`/children/${child.id}/sessions`, {
      method: 'POST',
      token: educator.token,
      body: { date: addDays(today(), -5), type: 'individual' },
    })

    const { status, body } = await api('/dashboard', { token: director.token })

    assert.equal(status, 200)
    assert.equal(body.data.children.total, 1)
    assert.equal(body.data.children.byGroup['Les Coquelicots'], 1)
    assert.equal(body.data.attendance.today.present, 1)
    assert.equal(body.data.progress.averageProgress, 40)
    assert.equal(body.data.progress.activeGoals, 1)
    // La seance passee n a pas de compte-rendu : elle doit remonter en attente.
    assert.ok(body.data.pendingReports.total >= 1)
  })
})

describe('Medicaments', () => {
  it('cree un traitement et liste les prises du jour', async () => {
    const created = await api(`/children/${child.id}/medications`, {
      method: 'POST',
      token: nurse.token,
      body: {
        name: 'Baclofene',
        dosage: '10 mg',
        route: 'oral',
        schedule: { times: ['12:00'], days: [] },
        startDate: addDays(today(), -10),
      },
    })

    assert.equal(created.status, 201, JSON.stringify(created.body))

    const { body } = await api('/medications/doses', { token: nurse.token })
    const dose = body.data.find((entry) => entry.medicationId === created.body.data.id)

    assert.ok(dose)
    assert.equal(dose.status, 'pending')
    assert.equal(dose.scheduledTime, '12:00')
  })

  it('fait disparaitre le rappel une fois la prise tracee', async () => {
    const { body: before } = await api('/notifications?type=medication-reminder', {
      token: nurse.token,
    })
    assert.ok(before.meta.summary.total >= 1)

    const dose = before.data[0]
    const medicationId = dose.id.split(':')[1]

    const recorded = await api(`/medications/${medicationId}/administrations`, {
      method: 'POST',
      token: nurse.token,
      body: { scheduledTime: '12:00', status: 'given', givenAt: '12:05' },
    })
    assert.equal(recorded.status, 201, JSON.stringify(recorded.body))

    const { body: after } = await api('/notifications?type=medication-reminder', {
      token: nurse.token,
    })
    assert.equal(after.meta.summary.total, before.meta.summary.total - 1)
  })

  it('refuse un horaire hors du traitement', async () => {
    const { body } = await api(`/children/${child.id}/medications`, { token: nurse.token })
    const medication = body.data[0]

    const { status } = await api(`/medications/${medication.id}/administrations`, {
      method: 'POST',
      token: nurse.token,
      body: { scheduledTime: '03:00', status: 'given' },
    })

    assert.equal(status, 400)
  })

  it('reste inaccessible a un educateur', async () => {
    const { status } = await api(`/children/${child.id}/medications`, { token: educator.token })
    assert.equal(status, 403)
  })
})

describe('Notifications', () => {
  it('adresse chaque type au bon role', async () => {
    const forNurse = await api('/notifications', { token: nurse.token })
    const forEducator = await api('/notifications', { token: educator.token })

    const types = (response) => new Set(response.body.data.map((item) => item.type))

    // Les rappels de medicaments sont medicaux : l educateur ne les voit pas.
    assert.equal(types(forEducator).has('medication-reminder'), false)
    assert.equal(types(forNurse).has('report-pending'), false)
  })

  it('remonte une alerte de sante signalee dans un compte-rendu', async () => {
    const session = await api(`/children/${child.id}/sessions`, {
      method: 'POST',
      token: educator.token,
      body: { date: today(), type: 'individual' },
    })

    await api(`/sessions/${session.body.data.id}/report`, {
      method: 'POST',
      token: educator.token,
      body: {
        mood: 'difficult',
        observations: "Seance ecourtee, l enfant se plaint de maux de ventre repetes.",
        healthFlag: { flagged: true, description: 'Douleurs abdominales a surveiller.' },
      },
    })

    const { body } = await api('/notifications?type=health-alert', { token: nurse.token })

    assert.equal(body.meta.summary.total, 1)
    assert.equal(body.data[0].severity, 'critical')
    assert.match(body.data[0].message, /abdominales/)
  })

  it('exige une description quand un point de sante est signale', async () => {
    const session = await api(`/children/${child.id}/sessions`, {
      method: 'POST',
      token: educator.token,
      body: { date: today(), type: 'group' },
    })

    const { status, body } = await api(`/sessions/${session.body.data.id}/report`, {
      method: 'POST',
      token: educator.token,
      body: {
        mood: 'neutral',
        observations: 'Seance ordinaire sans evenement particulier a signaler.',
        healthFlag: { flagged: true },
      },
    })

    assert.equal(status, 400)
    assert.ok(body.details['healthFlag.description'])
  })

  it('marque une notification comme lue', async () => {
    const { body } = await api('/notifications', { token: nurse.token })
    const first = body.data[0]

    const read = await api(`/notifications/${encodeURIComponent(first.id)}/read`, {
      method: 'POST',
      token: nurse.token,
    })
    assert.equal(read.status, 200)

    const unread = await api('/notifications?unreadOnly=true', { token: nurse.token })
    assert.equal(unread.body.data.some((item) => item.id === first.id), false)
  })

  it('enregistre puis retire un abonnement push', async () => {
    const created = await api('/notifications/subscriptions', {
      method: 'POST',
      token: nurse.token,
      body: { endpoint: 'https://push.example.org/abc123', platform: 'web' },
    })
    assert.equal(created.status, 201)

    const listed = await api('/notifications/subscriptions', { token: nurse.token })
    assert.equal(listed.body.data.length, 1)

    const removed = await api(`/notifications/subscriptions/${created.body.data.id}`, {
      method: 'DELETE',
      token: nurse.token,
    })
    assert.equal(removed.status, 200)
  })
})

describe('Export PDF', () => {
  it('renvoie un PDF nomme et non mis en cache', async () => {
    const response = await api(`/children/${child.id}/progress.pdf?months=6`, {
      token: director.token,
      raw: true,
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/pdf')
    assert.match(response.headers.get('content-disposition'), /attachment; filename="progression-/)
    assert.match(response.headers.get('cache-control'), /no-store/)

    const buffer = Buffer.from(await response.arrayBuffer())
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
    assert.ok(buffer.length > 1000, 'le PDF doit contenir autre chose qu un en-tete')
  })

  it('reste refuse a un educateur hors perimetre', async () => {
    const outsider = await createUserWithToken(api, {
      role: 'educator',
      groups: ['Un autre groupe'],
    })

    const response = await api(`/children/${child.id}/progress.pdf`, {
      token: outsider.token,
      raw: true,
    })

    assert.equal(response.status, 403)
  })
})
