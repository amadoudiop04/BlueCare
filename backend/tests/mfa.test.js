import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { PASSWORD, createChildDirect, createUserWithToken, startTestServer } from './helpers.js'
import { generateCode, stepFor } from '../src/utils/totp.js'

/** Double authentification : enrôlement, connexion en deux temps, codes de secours. */

let context
let api

/**
 * Code du pas suivant.
 *
 * Le code qui a servi a activer la 2FA est marque consommé : le rejouer pour
 * se connecter est refuse. En usage réel la connexion suivante arrive bien
 * plus tard ; dans un test tout se joue dans la même fenêtre de 30 secondes,
 * d'ou ce décalage d'un pas — accepte par la tolérance d'horloge.
 */
const freshCode = (secret) => generateCode(secret, stepFor() + 1)

/** Enrôle un compte et rend son secret + ses codes de secours. */
async function enableMfa(account) {
  const setup = await api('/auth/mfa/setup', { method: 'POST', token: account.token })
  assert.equal(setup.status, 201, JSON.stringify(setup.body))

  const { secret } = setup.body.data
  const enabled = await api('/auth/mfa/enable', {
    method: 'POST',
    token: account.token,
    body: { code: generateCode(secret) },
  })
  assert.equal(enabled.status, 200, JSON.stringify(enabled.body))

  return { secret, recoveryCodes: enabled.body.data.recoveryCodes }
}

const loginWith = (email, password = PASSWORD) =>
  api('/auth/login', { method: 'POST', body: { email, password } })

before(async () => {
  context = await startTestServer()
  api = context.api
})

after(() => context?.close())

describe('Enrolement', () => {
  it('rend une URI otpauth scannable, sans activer tout de suite', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const setup = await api('/auth/mfa/setup', { method: 'POST', token: account.token })

    assert.equal(setup.status, 201)
    assert.match(setup.body.data.secret, /^[A-Z2-7]{32}$/)
    assert.match(setup.body.data.otpauthUri, /^otpauth:\/\/totp\//)
    assert.ok(setup.body.data.otpauthUri.includes(encodeURIComponent(account.email)))

    // Tant que le code n'est pas confirme, la connexion reste à un facteur.
    const login = await loginWith(account.email)
    assert.equal(login.status, 200)
    assert.ok(login.body.meta.sessionToken)
  })

  it('refuse d activer avec un code errone', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await api('/auth/mfa/setup', { method: 'POST', token: account.token })

    const { status } = await api('/auth/mfa/enable', {
      method: 'POST',
      token: account.token,
      body: { code: '000000' },
    })

    assert.equal(status, 401)
  })

  it('active et delivre des codes de secours, une seule fois', async () => {
    const account = await createUserWithToken(api, { role: 'nurse' })
    const { recoveryCodes } = await enableMfa(account)

    assert.equal(recoveryCodes.length, 8)
    assert.ok(recoveryCodes.every((code) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)))

    const status = await api('/auth/mfa', { token: account.token })
    assert.equal(status.body.data.enabled, true)
    assert.equal(status.body.data.recoveryCodesLeft, 8)
  })

  it('refuse un second enrolement sur un compte deja protege', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await enableMfa(account)

    const { status } = await api('/auth/mfa/setup', { method: 'POST', token: account.token })
    assert.equal(status, 409)
  })
})

describe('Connexion en deux temps', () => {
  it('ne delivre aucun jeton d acces avant le code', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await enableMfa(account)

    const login = await loginWith(account.email)

    assert.equal(login.status, 200)
    assert.equal(login.body.data.mfaRequired, true)
    assert.ok(login.body.meta.challengeToken)
    assert.equal(login.body.meta.sessionToken, undefined)
    assert.equal(login.body.meta.refreshToken, undefined)
  })

  it('le jeton de defi n ouvre aucune route metier', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await enableMfa(account)

    const login = await loginWith(account.email)
    const { status } = await api('/children', { token: login.body.meta.challengeToken })

    assert.equal(status, 401)
  })

  it('echange le code contre les jetons', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const { secret } = await enableMfa(account)

    const login = await loginWith(account.email)
    const verified = await api('/auth/mfa/verify', {
      method: 'POST',
      body: { challengeToken: login.body.meta.challengeToken, code: freshCode(secret) },
    })

    assert.equal(verified.status, 200, JSON.stringify(verified.body))
    assert.ok(verified.body.meta.sessionToken)
    assert.equal(verified.body.data.user.email, account.email)
    // Ni le secret ni les codes de secours ne doivent transiter.
    assert.equal(verified.body.data.user.totpSecret, undefined)
    assert.equal(verified.body.data.user.recoveryCodes, undefined)
    assert.equal(verified.body.data.user.mfaEnabled, true)

    const me = await api('/auth/me', { token: verified.body.meta.sessionToken })
    assert.equal(me.status, 200)
  })

  it('refuse un code errone', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await enableMfa(account)

    const login = await loginWith(account.email)
    const { status } = await api('/auth/mfa/verify', {
      method: 'POST',
      body: { challengeToken: login.body.meta.challengeToken, code: '000000' },
    })

    assert.equal(status, 401)
  })

  it('refuse de rejouer un code deja consomme', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const { secret } = await enableMfa(account)
    const code = freshCode(secret)

    const first = await loginWith(account.email)
    const ok = await api('/auth/mfa/verify', {
      method: 'POST',
      body: { challengeToken: first.body.meta.challengeToken, code },
    })
    assert.equal(ok.status, 200)

    // Le code reste mathematiquement valable pendant sa fenêtre : c'est le
    // suivi du dernier pas consommé qui bloque la relecture.
    const second = await loginWith(account.email)
    const replay = await api('/auth/mfa/verify', {
      method: 'POST',
      body: { challengeToken: second.body.meta.challengeToken, code },
    })

    assert.equal(replay.status, 401)
    assert.match(replay.body.message, /déjà été utilisé/)
  })

  it('refuse que le code d activation serve aussi a se connecter', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const setup = await api('/auth/mfa/setup', { method: 'POST', token: account.token })
    const { secret } = setup.body.data

    const activationCode = generateCode(secret)
    await api('/auth/mfa/enable', {
      method: 'POST',
      token: account.token,
      body: { code: activationCode },
    })

    const login = await loginWith(account.email)
    const { status, body } = await api('/auth/mfa/verify', {
      method: 'POST',
      body: { challengeToken: login.body.meta.challengeToken, code: activationCode },
    })

    assert.equal(status, 401)
    assert.match(body.message, /déjà été utilisé/)
  })
})

describe('Codes de secours', () => {
  it('remplace le code TOTP, une seule fois chacun', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const { recoveryCodes } = await enableMfa(account)
    const [recovery] = recoveryCodes

    const login = await loginWith(account.email)
    const used = await api('/auth/mfa/verify', {
      method: 'POST',
      body: { challengeToken: login.body.meta.challengeToken, code: recovery },
    })
    assert.equal(used.status, 200, JSON.stringify(used.body))

    const status = await api('/auth/mfa', { token: used.body.meta.sessionToken })
    assert.equal(status.body.data.recoveryCodesLeft, 7)

    // Le même code ne doit plus fonctionner.
    const again = await loginWith(account.email)
    const replay = await api('/auth/mfa/verify', {
      method: 'POST',
      body: { challengeToken: again.body.meta.challengeToken, code: recovery },
    })
    assert.equal(replay.status, 401)
  })
})

describe('Protection contre le forcage', () => {
  it('verrouille le compte apres cinq codes errones', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await enableMfa(account)

    const login = await loginWith(account.email)
    const challengeToken = login.body.meta.challengeToken

    const codes = ['111111', '222222', '333333', '444444', '555555']
    const statuses = []

    for (const code of codes) {
      const { status } = await api('/auth/mfa/verify', {
        method: 'POST',
        body: { challengeToken, code },
      })
      statuses.push(status)
    }

    assert.deepEqual(statuses.slice(0, 4), [401, 401, 401, 401])
    assert.equal(statuses[4], 403, 'la cinquieme tentative doit verrouiller')

    // Même un code valide est refuse tant que le verrou court.
    const { status } = await api('/auth/mfa/verify', {
      method: 'POST',
      body: { challengeToken, code: '999999' },
    })
    assert.equal(status, 403)
  })
})

describe('Desactivation et reinitialisation', () => {
  it('exige le mot de passe ET un code valide pour desactiver', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const { secret } = await enableMfa(account)

    const wrongPassword = await api('/auth/mfa/disable', {
      method: 'POST',
      token: account.token,
      body: { password: 'mauvais', code: freshCode(secret) },
    })
    assert.equal(wrongPassword.status, 401)

    const disabled = await api('/auth/mfa/disable', {
      method: 'POST',
      token: account.token,
      body: { password: PASSWORD, code: freshCode(secret) },
    })
    assert.equal(disabled.status, 200, JSON.stringify(disabled.body))

    // La connexion redevient a un facteur.
    const login = await loginWith(account.email)
    assert.ok(login.body.meta.sessionToken)
  })

  it('interdit de retirer la 2FA quand le role l impose', async () => {
    const admin = await createUserWithToken(api, { role: 'admin' })
    const { secret } = await enableMfa(admin)

    const { status } = await api('/auth/mfa/disable', {
      method: 'POST',
      token: admin.token,
      body: { password: PASSWORD, code: freshCode(secret) },
    })

    assert.equal(status, 403)
  })

  it('la direction reinitialise le second facteur d un telephone perdu', async () => {
    const director = await createUserWithToken(api, { role: 'director' })
    const victim = await createUserWithToken(api, { role: 'educator' })
    await enableMfa(victim)

    const reset = await api(`/users/${victim.user.id}/mfa/reset`, {
      method: 'POST',
      token: director.token,
    })
    assert.equal(reset.status, 200)

    const login = await loginWith(victim.email)
    assert.ok(login.body.meta.sessionToken, 'la connexion redevient a un facteur')
  })

  it('un educateur ne peut pas reinitialiser le second facteur d un autre', async () => {
    const educator = await createUserWithToken(api, { role: 'educator' })
    const other = await createUserWithToken(api, { role: 'educator' })

    const { status } = await api(`/users/${other.user.id}/mfa/reset`, {
      method: 'POST',
      token: educator.token,
    })

    assert.equal(status, 403)
  })
})

describe('Role administrateur', () => {
  it('accede a tous les ecrans de l equipe et a la direction', async () => {
    const admin = await createUserWithToken(api, { role: 'admin' })
    await createChildDirect({ lastName: 'PourAdmin', group: 'Un groupe' })

    const paths = [
      '/children',
      '/dashboard',
      '/users',
      '/sessions',
      '/reports/pending',
      '/attendance/alerts',
      '/medications/doses',
      '/notifications',
      '/reference',
    ]

    for (const path of paths) {
      const { status } = await api(path, { token: admin.token })
      assert.ok(status < 400, `${path} devrait etre ouvert a l administrateur (recu ${status})`)
    }
  })

  it('voit tous les enfants, sans restriction de groupe', async () => {
    const admin = await createUserWithToken(api, { role: 'admin' })
    const child = await createChildDirect({ lastName: 'HorsGroupe', group: 'Groupe isole' })

    const { status, body } = await api(`/children/${child.id}`, { token: admin.token })

    assert.equal(status, 200)
    // Périmètre complet ET accès médical : le médecin référent reste visible.
    assert.notEqual(body.data.referringDoctor, null)
  })

  it('peut ecrire partout : objectifs, seances, traitements', async () => {
    const admin = await createUserWithToken(api, { role: 'admin' })
    const child = await createChildDirect({ lastName: 'EcritureAdmin', group: 'Groupe admin' })

    const goal = await api(`/children/${child.id}/goals`, {
      method: 'POST',
      token: admin.token,
      body: { title: 'Objectif crée par l\'administrateur', domain: 'social' },
    })
    assert.equal(goal.status, 201, JSON.stringify(goal.body))

    const session = await api(`/children/${child.id}/sessions`, {
      method: 'POST',
      token: admin.token,
      body: { date: new Date().toISOString().slice(0, 10), type: 'individual' },
    })
    assert.equal(session.status, 201)

    const medication = await api(`/children/${child.id}/medications`, {
      method: 'POST',
      token: admin.token,
      body: {
        name: 'Doliprane',
        dosage: '150 mg',
        schedule: { times: ['08:00'], days: [] },
        startDate: new Date().toISOString().slice(0, 10),
      },
    })
    assert.equal(medication.status, 201, JSON.stringify(medication.body))
  })
})
