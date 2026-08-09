import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { PASSWORD, createChildDirect, createUserWithToken, startTestServer } from './helpers.js'
import { generateCode, stepFor } from '../src/utils/totp.js'
import { today as todayIso } from '../src/utils/dates.js'

/** Gestion de son propre compte : mot de passe et suppression. */

let context
let api
let child

const loginWith = (email, password = PASSWORD) =>
  api('/auth/login', { method: 'POST', body: { email, password } })

/** Cree une seance et son compte-rendu, pour rattacher du travail a un compte. */
async function authorSomeWork(account) {
  const session = await api(`/children/${child.id}/sessions`, {
    method: 'POST',
    token: account.token,
    body: { date: todayIso(), type: 'individual' },
  })
  assert.equal(session.status, 201, JSON.stringify(session.body))

  const report = await api(`/sessions/${session.body.data.id}/report`, {
    method: 'POST',
    token: account.token,
    body: { mood: 'good', observations: 'Observation de test suffisamment longue pour passer.' },
  })
  assert.equal(report.status, 201, JSON.stringify(report.body))
}

before(async () => {
  context = await startTestServer()
  api = context.api

  child = await createChildDirect({ group: 'Les Coquelicots' })
  // Un directeur permanent : sans lui, aucun compte de direction ne pourrait
  // se supprimer (protection contre le centre sans administrateur).
  await createUserWithToken(api, { role: 'director' })
})

after(() => context?.close())

describe('Changer son mot de passe', () => {
  it("exige l ancien mot de passe", async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const { status } = await api('/auth/password', {
      method: 'POST',
      token: account.token,
      body: { currentPassword: 'faux', newPassword: 'NouveauSecret2026!' },
    })

    assert.equal(status, 401)
  })

  it('impose la longueur minimale', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const { status, body } = await api('/auth/password', {
      method: 'POST',
      token: account.token,
      body: { currentPassword: PASSWORD, newPassword: 'court' },
    })

    assert.equal(status, 400)
    assert.ok(body.details.newPassword)
  })

  it('refuse de reprendre le meme mot de passe', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const { status } = await api('/auth/password', {
      method: 'POST',
      token: account.token,
      body: { currentPassword: PASSWORD, newPassword: PASSWORD },
    })

    assert.equal(status, 400)
  })

  it('remplace le mot de passe et ferme les autres sessions', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const other = await loginWith(account.email)

    const changed = await api('/auth/password', {
      method: 'POST',
      token: account.token,
      body: { currentPassword: PASSWORD, newPassword: 'NouveauSecret2026!' },
    })

    assert.equal(changed.status, 200)
    assert.equal(changed.body.data.otherSessionsClosed, 1)

    assert.equal((await loginWith(account.email, 'NouveauSecret2026!')).status, 200)
    assert.equal((await loginWith(account.email)).status, 401)
    // La session qui a fait le changement survit, l'autre non.
    assert.equal((await api('/auth/me', { token: account.token })).status, 200)
    assert.equal((await api('/auth/me', { token: other.body.meta.sessionToken })).status, 401)
  })
})

describe('Supprimer son compte', () => {
  it('annonce ce qui sera efface avant de le faire', async () => {
    const account = await createUserWithToken(api, {
      role: 'educator',
      groups: ['Les Coquelicots'],
    })

    const before = await api('/auth/account/deletion', { token: account.token })
    assert.equal(before.status, 200)
    assert.equal(before.body.data.mode, 'erase')
    assert.equal(before.body.data.authoredRecords, 0)

    await authorSomeWork(account)

    const after = await api('/auth/account/deletion', { token: account.token })
    assert.equal(after.body.data.mode, 'anonymise')
    assert.equal(after.body.data.reports, 1)
    assert.equal(after.body.data.sessions, 1)
  })

  it('exige le mot de passe', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const missing = await api('/auth/account', { method: 'DELETE', token: account.token, body: {} })
    assert.equal(missing.status, 400)

    const wrong = await api('/auth/account', {
      method: 'DELETE',
      token: account.token,
      body: { password: 'mauvais' },
    })
    assert.equal(wrong.status, 401)

    // Le compte est intact.
    assert.equal((await api('/auth/me', { token: account.token })).status, 200)
  })

  it('efface entierement un compte sans travail rattache', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const { status, body } = await api('/auth/account', {
      method: 'DELETE',
      token: account.token,
      body: { password: PASSWORD },
    })

    assert.equal(status, 200, JSON.stringify(body))
    assert.equal(body.data.mode, 'erase')

    // Plus de session, plus de connexion possible.
    assert.equal((await api('/auth/me', { token: account.token })).status, 401)
    assert.equal((await loginWith(account.email)).status, 401)
  })

  it('anonymise un compte qui a signe des comptes-rendus', async () => {
    const director = await createUserWithToken(api, { role: 'director' })
    const account = await createUserWithToken(api, {
      role: 'educator',
      groups: ['Les Coquelicots'],
    })
    await authorSomeWork(account)

    const { status, body } = await api('/auth/account', {
      method: 'DELETE',
      token: account.token,
      body: { password: PASSWORD },
    })

    assert.equal(status, 200, JSON.stringify(body))
    assert.equal(body.data.mode, 'anonymise')
    assert.equal(body.data.keptRecords, 2)

    assert.equal((await loginWith(account.email)).status, 401)

    // La ligne survit pour que le compte-rendu garde un auteur, mais elle ne
    // porte plus aucune donnee personnelle.
    const users = await api('/users?status=disabled&pageSize=100', { token: director.token })
    const anonymised = users.body.data.find((entry) => entry.id === account.user.id)

    assert.ok(anonymised, 'la ligne doit subsister')
    assert.equal(anonymised.firstName, 'Compte')
    assert.equal(anonymised.lastName, 'supprime')
    assert.equal(anonymised.status, 'disabled')
    assert.equal(anonymised.email.includes(account.email), false)
    assert.match(anonymised.email, /@compte-supprime\.invalid$/)
    assert.deepEqual(anonymised.groups, [])
  })

  it('ferme toutes les sessions du compte supprime', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const other = await loginWith(account.email)

    await api('/auth/account', {
      method: 'DELETE',
      token: account.token,
      body: { password: PASSWORD },
    })

    assert.equal((await api('/auth/me', { token: other.body.meta.sessionToken })).status, 401)
  })

  it('exige aussi le second facteur quand il est actif', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const setup = await api('/auth/mfa/setup', { method: 'POST', token: account.token })
    const { secret } = setup.body.data
    await api('/auth/mfa/enable', {
      method: 'POST',
      token: account.token,
      body: { code: generateCode(secret) },
    })

    const withoutCode = await api('/auth/account', {
      method: 'DELETE',
      token: account.token,
      body: { password: PASSWORD },
    })
    assert.equal(withoutCode.status, 400)

    const withCode = await api('/auth/account', {
      method: 'DELETE',
      token: account.token,
      body: { password: PASSWORD, code: generateCode(secret, stepFor() + 1) },
    })
    assert.equal(withCode.status, 200, JSON.stringify(withCode.body))
  })

  it('refuse de laisser le centre sans compte de direction', async () => {
    // Un serveur neuf : le seul directeur ne doit pas pouvoir partir.
    const solo = await startTestServer()
    const onlyDirector = await createUserWithToken(solo.api, { role: 'director' })

    const { status, body } = await solo.api('/auth/account', {
      method: 'DELETE',
      token: onlyDirector.token,
      body: { password: PASSWORD },
    })

    assert.equal(status, 409)
    assert.match(body.message, /dernier compte de direction/)

    // Avec un remplacant, le depart redevient possible.
    await createUserWithToken(solo.api, { role: 'admin' })
    const retry = await solo.api('/auth/account', {
      method: 'DELETE',
      token: onlyDirector.token,
      body: { password: PASSWORD },
    })
    assert.equal(retry.status, 200)

    solo.close()
  })
})
