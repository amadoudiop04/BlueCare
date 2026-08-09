import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createChildDirect, createUserWithToken, startTestServer } from './helpers.js'
import { addDays, addMonths, today } from '../src/utils/dates.js'

/** Objectifs, seances, comptes-rendus et courbes d evolution. */

let context
let api
let director
let educator
let child

const asEducator = (path, options = {}) => api(path, { ...options, token: educator.token })

async function createGoal(overrides = {}) {
  const { status, body } = await asEducator(`/children/${child.id}/goals`, {
    method: 'POST',
    body: { title: 'Formuler une demande', domain: 'communication', ...overrides },
  })
  assert.equal(status, 201, JSON.stringify(body))
  return body.data
}

async function createSession(overrides = {}) {
  const { status, body } = await asEducator(`/children/${child.id}/sessions`, {
    method: 'POST',
    body: { date: today(), type: 'individual', ...overrides },
  })
  assert.equal(status, 201, JSON.stringify(body))
  return body.data
}

const reportBody = (overrides = {}) => ({
  mood: 'good',
  observations: "Seance calme, l enfant a suivi les consignes proposees sans difficulte.",
  ...overrides,
})

before(async () => {
  context = await startTestServer()
  api = context.api

  child = await createChildDirect({ group: 'Les Coquelicots' })
  director = await createUserWithToken(api, { role: 'director' })
  educator = await createUserWithToken(api, { role: 'educator', groups: ['Les Coquelicots'] })
})

after(() => context?.close())

describe('Objectifs pedagogiques', () => {
  it('cree un objectif a 0 % et le fait progresser', async () => {
    const goal = await createGoal({ title: 'Objectif progression' })

    assert.equal(goal.progress, 0)
    assert.equal(goal.status, 'active')
    assert.equal(goal.childId, child.id)

    const { status, body } = await asEducator(`/goals/${goal.id}`, {
      method: 'PATCH',
      body: { progress: 40 },
    })

    assert.equal(status, 200)
    assert.equal(body.data.progress, 40)
  })

  it('bascule en atteint a 100 %, et inversement', async () => {
    const goal = await createGoal({ title: 'Objectif atteint' })

    const achieved = await asEducator(`/goals/${goal.id}`, {
      method: 'PATCH',
      body: { progress: 100 },
    })
    assert.equal(achieved.body.data.status, 'achieved')
    assert.ok(achieved.body.data.achievedAt)

    const reopened = await asEducator(`/goals/${goal.id}`, {
      method: 'PATCH',
      body: { status: 'active' },
    })
    assert.equal(reopened.body.data.status, 'active')
    assert.equal(reopened.body.data.achievedAt, null)
  })

  it("valide le domaine et le taux d avancement", async () => {
    const { status, body } = await asEducator(`/children/${child.id}/goals`, {
      method: 'POST',
      body: { title: 'Objectif invalide', domain: 'inconnu', progress: 150 },
    })

    assert.equal(status, 400)
    assert.ok(body.details.domain)
    assert.ok(body.details.progress)
  })

  it('resume les objectifs d un enfant', async () => {
    const { body } = await asEducator(`/children/${child.id}/goals`)

    assert.ok(body.meta.summary.total >= 2)
    assert.equal(typeof body.meta.summary.averageProgress, 'number')
  })
})

describe('Seances', () => {
  it('marque realisee une seance du jour et planifiee une seance a venir', async () => {
    const past = await createSession({ date: addDays(today(), -1) })
    const future = await createSession({ date: addDays(today(), 7) })

    assert.equal(past.status, 'completed')
    assert.equal(future.status, 'planned')
  })

  it("refuse de rattacher l objectif d un autre enfant", async () => {
    const other = await createChildDirect({ lastName: 'Autre', group: 'Les Coquelicots' })
    const created = await asEducator(`/children/${other.id}/goals`, {
      method: 'POST',
      body: { title: 'Objectif de l autre enfant', domain: 'motor' },
    })

    const { status, body } = await asEducator(`/children/${child.id}/sessions`, {
      method: 'POST',
      body: { date: today(), type: 'individual', goalIds: [created.body.data.id] },
    })

    assert.equal(status, 400)
    assert.ok(body.details.goalIds)
  })

  it('annule une seance sans compte-rendu', async () => {
    const session = await createSession({ date: addDays(today(), 3) })

    const { status, body } = await asEducator(`/sessions/${session.id}/cancel`, {
      method: 'POST',
      body: { reason: 'Enfant absent' },
    })

    assert.equal(status, 200)
    assert.equal(body.data.status, 'cancelled')
  })

  it("rend l historique complet d un enfant", async () => {
    const { status, body } = await asEducator(`/children/${child.id}/sessions`)

    assert.equal(status, 200)
    assert.ok(body.meta.summary.total >= 3)
    assert.equal(typeof body.meta.summary.completed, 'number')
    assert.ok(body.data.every((session) => 'report' in session))
  })
})

describe('Comptes-rendus de seance', () => {
  it("enregistre humeur, observations et points d attention", async () => {
    const session = await createSession()

    const { status, body } = await asEducator(`/sessions/${session.id}/report`, {
      method: 'POST',
      body: reportBody({
        mood: 'very-good',
        attentionPoints: ['Fatigue en fin de seance'],
        nextSteps: 'Reprendre le meme support.',
      }),
    })

    assert.equal(status, 201, JSON.stringify(body))
    assert.equal(body.data.mood, 'very-good')
    assert.deepEqual(body.data.attentionPoints, ['Fatigue en fin de seance'])
    assert.equal(body.data.authorId, educator.user.id)
  })

  it("reporte le taux d avancement sur l objectif travaille", async () => {
    const goal = await createGoal({ title: 'Objectif suivi en seance' })
    const session = await createSession({ goalIds: [goal.id] })

    const { body } = await asEducator(`/sessions/${session.id}/report`, {
      method: 'POST',
      body: reportBody({
        goalProgress: [{ goalId: goal.id, progress: 55, comment: 'Nette amelioration.' }],
      }),
    })

    assert.equal(body.meta.updatedGoals[0].progress, 55)

    const reread = await asEducator(`/goals/${goal.id}`)
    assert.equal(reread.body.data.progress, 55)
  })

  it('refuse un second compte-rendu sur la meme seance', async () => {
    const session = await createSession()
    await asEducator(`/sessions/${session.id}/report`, { method: 'POST', body: reportBody() })

    const { status } = await asEducator(`/sessions/${session.id}/report`, {
      method: 'POST',
      body: reportBody(),
    })

    assert.equal(status, 409)
  })

  it('refuse un compte-rendu sur une seance a venir', async () => {
    const session = await createSession({ date: addDays(today(), 5) })

    const { status } = await asEducator(`/sessions/${session.id}/report`, {
      method: 'POST',
      body: reportBody(),
    })

    assert.equal(status, 409)
  })

  it('exige humeur et observations', async () => {
    const session = await createSession()

    const { status, body } = await asEducator(`/sessions/${session.id}/report`, {
      method: 'POST',
      body: { mood: 'inconnue', observations: 'court' },
    })

    assert.equal(status, 400)
    assert.ok(body.details.mood)
    assert.ok(body.details.observations)
  })

  it('rejette un objectif appartenant a un autre enfant', async () => {
    const other = await createChildDirect({ lastName: 'Etranger', group: 'Les Coquelicots' })
    const foreign = await asEducator(`/children/${other.id}/goals`, {
      method: 'POST',
      body: { title: 'Objectif etranger', domain: 'motor' },
    })
    const session = await createSession()

    const { status, body } = await asEducator(`/sessions/${session.id}/report`, {
      method: 'POST',
      body: reportBody({ goalProgress: [{ goalId: foreign.body.data.id, progress: 30 }] }),
    })

    assert.equal(status, 400)
    assert.ok(body.details.goalProgress)
  })

  it('liste les comptes-rendus en attente', async () => {
    await createSession({ date: addDays(today(), -10) })

    const { status, body } = await asEducator('/reports/pending')

    assert.equal(status, 200)
    assert.ok(body.meta.summary.total >= 1)
    assert.ok(body.meta.summary.overdue >= 1)
  })
})

describe("Courbes d evolution", () => {
  it('produit une serie mensuelle et une tendance par objectif', async () => {
    const subject = await createChildDirect({ lastName: 'Courbe', group: 'Les Coquelicots' })

    const goal = await api(`/children/${subject.id}/goals`, {
      method: 'POST',
      token: educator.token,
      body: { title: 'Objectif suivi sur six mois', domain: 'communication' },
    })
    const goalId = goal.body.data.id

    // Trois seances etalees sur trois mois, avec une progression croissante.
    for (const [monthsAgo, progress] of [
      [3, 20],
      [2, 45],
      [1, 70],
    ]) {
      const session = await api(`/children/${subject.id}/sessions`, {
        method: 'POST',
        token: educator.token,
        body: { date: addMonths(today(), -monthsAgo), type: 'individual', goalIds: [goalId] },
      })

      await api(`/sessions/${session.body.data.id}/report`, {
        method: 'POST',
        token: educator.token,
        body: reportBody({ goalProgress: [{ goalId, progress }] }),
      })
    }

    const { status, body } = await api(`/children/${subject.id}/progress?months=6`, {
      token: educator.token,
    })

    assert.equal(status, 200)
    assert.equal(body.meta.period.months, 6)

    const serie = body.data.goals.find((entry) => entry.goal.id === goalId)
    assert.equal(serie.points.length, 3)
    assert.equal(serie.trend.start, 20)
    assert.equal(serie.trend.current, 70)
    assert.equal(serie.trend.delta, 50)

    // Sept mois couverts (bornes incluses), les mois sans seance restent a null.
    assert.equal(serie.monthly.length, 7)
    assert.ok(serie.monthly.some((month) => month.average === null))
    assert.ok(serie.monthly.some((month) => month.average === 45))

    assert.equal(body.data.mood.points.length, 3)
    assert.equal(body.meta.summary.averageProgress, 70)
  })

  it('rend une serie vide sans seance', async () => {
    const fresh = await createChildDirect({ lastName: 'Vierge', group: 'Les Coquelicots' })
    await api(`/children/${fresh.id}/goals`, {
      method: 'POST',
      token: educator.token,
      body: { title: 'Objectif jamais travaille', domain: 'social' },
    })

    const { body } = await api(`/children/${fresh.id}/progress`, { token: educator.token })
    const serie = body.data.goals[0]

    assert.deepEqual(serie.points, [])
    assert.equal(serie.trend.delta, null)
    assert.ok(serie.monthly.every((month) => month.average === null))
  })

  it('reste accessible a la direction', async () => {
    const { status } = await api(`/children/${child.id}/progress`, { token: director.token })
    assert.equal(status, 200)
  })
})
