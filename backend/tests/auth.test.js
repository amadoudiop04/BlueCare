import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { PASSWORD, createChildDirect, createUserWithToken, startTestServer } from './helpers.js'

/** Authentification JWT, contrôle d'accès par rôle et périmètre des données. */

let context
let api
let director
let nurse
let educator // Les Coquelicots
let otherEducator // Les Bleuets
let family
let coquelicot
let bleuet

before(async () => {
  context = await startTestServer()
  api = context.api

  coquelicot = await createChildDirect({ lastName: 'Coquelicot', group: 'Les Coquelicots' })
  bleuet = await createChildDirect({
    firstName: 'Sofia',
    lastName: 'Bleuet',
    group: 'Les Bleuets',
  })

  director = await createUserWithToken(api, { role: 'director' })
  nurse = await createUserWithToken(api, { role: 'nurse' })
  educator = await createUserWithToken(api, { role: 'educator', groups: ['Les Coquelicots'] })
  otherEducator = await createUserWithToken(api, { role: 'educator', groups: ['Les Bleuets'] })
  family = await createUserWithToken(api, { role: 'family', childIds: [coquelicot.id] })
})

after(() => context?.close())

describe('Connexion', () => {
  it('ouvre une session et pose un cookie httpOnly', async () => {
    const response = await api('/auth/login', {
      method: 'POST',
      body: { email: director.email, password: PASSWORD },
      raw: true,
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.data.user.role, 'director')
    assert.ok(body.meta.sessionToken)

    const cookie = response.headers.get('set-cookie')
    assert.ok(cookie, 'la reponse doit poser un cookie de session')
    assert.match(cookie, /bluecare_session=/)
    // Les trois attributs qui rendent le cookie inutilisable par un script
    // ou par un autre site.
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Strict/i)
    assert.match(cookie, /Path=\//i)

    // Le hachage ne doit jamais sortir du serveur.
    assert.equal(JSON.stringify(body).includes('passwordHash'), false)
  })

  it('authentifie a partir du seul cookie, sans en-tete Authorization', async () => {
    const response = await api('/auth/login', {
      method: 'POST',
      body: { email: nurse.email, password: PASSWORD },
      raw: true,
    })
    const cookie = response.headers.get('set-cookie').split(';')[0]

    const { status, body } = await api('/auth/me', { headers: { Cookie: cookie } })

    assert.equal(status, 200)
    assert.equal(body.data.user.role, 'nurse')
  })

  it('refuse un mot de passe errone', async () => {
    const { status } = await api('/auth/login', {
      method: 'POST',
      body: { email: director.email, password: 'mauvais-mot-de-passe' },
    })

    assert.equal(status, 401)
  })

  it('donne la meme reponse pour un compte inexistant', async () => {
    const unknown = await api('/auth/login', {
      method: 'POST',
      body: { email: 'personne@test.local', password: PASSWORD },
    })
    const wrongPassword = await api('/auth/login', {
      method: 'POST',
      body: { email: director.email, password: 'autre-mot-de-passe' },
    })

    assert.equal(unknown.status, 401)
    assert.equal(unknown.body.message, wrongPassword.body.message)
  })

  it('renvoie le profil et son perimetre', async () => {
    const { status, body } = await api('/auth/me', { token: educator.token })

    assert.equal(status, 200)
    assert.equal(body.data.user.role, 'educator')
    assert.deepEqual(body.data.scope.groups, ['Les Coquelicots'])
  })

  it('refuse un jeton bricole', async () => {
    const { status } = await api('/auth/me', { token: 'pas-un-jeton-de-session' })
    assert.equal(status, 401)
  })

  it('ferme la session a la deconnexion, cote serveur', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    assert.equal((await api('/auth/me', { token: account.token })).status, 200)

    const loggedOut = await api('/auth/logout', { method: 'POST', token: account.token })
    assert.equal(loggedOut.status, 200)

    // Le jeton n'est plus adosse a aucune ligne : il ne vaut plus rien.
    assert.equal((await api('/auth/me', { token: account.token })).status, 401)
  })

  it('liste les appareils connectes et signale la session courante', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    // Une seconde connexion simule un autre appareil.
    await api('/auth/login', {
      method: 'POST',
      body: { email: account.email, password: PASSWORD },
    })

    const { status, body } = await api('/auth/sessions', { token: account.token })

    assert.equal(status, 200)
    assert.equal(body.data.length, 2)
    assert.equal(body.data.filter((session) => session.current).length, 1)
    // Le hachage du jeton ne doit jamais sortir.
    assert.equal(JSON.stringify(body).includes('tokenHash'), false)
  })

  it('deconnecte les autres appareils sans toucher au sien', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const other = await api('/auth/login', {
      method: 'POST',
      body: { email: account.email, password: PASSWORD },
    })
    const otherToken = other.body.meta.sessionToken

    const revoked = await api('/auth/sessions', { method: 'DELETE', token: account.token })
    assert.equal(revoked.status, 200)
    assert.equal(revoked.body.data.revoked, 1)

    assert.equal((await api('/auth/me', { token: account.token })).status, 200)
    assert.equal((await api('/auth/me', { token: otherToken })).status, 401)
  })

  it('ferme les autres sessions au changement de mot de passe', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    const other = await api('/auth/login', {
      method: 'POST',
      body: { email: account.email, password: PASSWORD },
    })

    const changed = await api('/auth/password', {
      method: 'POST',
      token: account.token,
      body: { currentPassword: PASSWORD, newPassword: 'NouveauSecret2026!' },
    })

    assert.equal(changed.status, 200)
    assert.equal(changed.body.data.otherSessionsClosed, 1)
    // La session qui a fait le changement reste ouverte, les autres tombent.
    assert.equal((await api('/auth/me', { token: account.token })).status, 200)
    assert.equal((await api('/auth/me', { token: other.body.meta.sessionToken })).status, 401)
  })

  it('protege les routes metier', async () => {
    for (const path of ['/children', '/attendance/alerts', '/dashboard', '/notifications']) {
      const { status } = await api(path)
      assert.equal(status, 401, `${path} devrait exiger un jeton`)
    }
  })

  it('bloque un Compte desactive', async () => {
    const victim = await createUserWithToken(api, { role: 'educator', groups: ['Les Bleuets'] })

    await api(`/users/${victim.user.id}`, {
      method: 'DELETE',
      token: director.token,
    })

    // La session existe toujours, mais le compte est relu à chaque requête.
    const { status } = await api('/auth/me', { token: victim.token })
    assert.equal(status, 403)
  })

  it("change le mot de passe apres verification de l ancien", async () => {
    const user = await createUserWithToken(api, { role: 'educator' })

    const wrong = await api('/auth/password', {
      method: 'POST',
      token: user.token,
      body: { currentPassword: 'faux', newPassword: 'NouveauSecret2026!' },
    })
    assert.equal(wrong.status, 401)

    const changed = await api('/auth/password', {
      method: 'POST',
      token: user.token,
      body: { currentPassword: PASSWORD, newPassword: 'NouveauSecret2026!' },
    })
    assert.equal(changed.status, 200)

    const relogin = await api('/auth/login', {
      method: 'POST',
      body: { email: user.email, password: 'NouveauSecret2026!' },
    })
    assert.equal(relogin.status, 200)
  })

  it('impose une longueur minimale de mot de passe', async () => {
    const { status, body } = await api('/users', {
      method: 'POST',
      token: director.token,
      body: {
        email: 'court@test.local',
        role: 'educator',
        firstName: 'Court',
        lastName: 'Test',
        password: 'court',
      },
    })

    assert.equal(status, 400)
    assert.ok(body.details.password)
  })
})

describe("Controle d acces par role", () => {
  const cases = [
    { path: '/dashboard', allowed: ['director'], denied: ['educator', 'nurse', 'family'] },
    { path: '/users', allowed: ['director'], denied: ['educator', 'nurse', 'family'] },
    { path: '/medications/doses', allowed: ['director', 'nurse'], denied: ['educator', 'family'] },
    { path: '/sessions', allowed: ['director', 'nurse', 'educator'], denied: ['family'] },
    { path: '/reports/pending', allowed: ['director', 'nurse', 'educator'], denied: ['family'] },
    { path: '/attendance/alerts', allowed: ['director', 'nurse', 'educator'], denied: ['family'] },
  ]

  it('ouvre chaque route aux seuls roles prevus', async () => {
    const tokens = () => ({
      director: director.token,
      nurse: nurse.token,
      educator: educator.token,
      family: family.token,
    })

    for (const { path, allowed, denied } of cases) {
      for (const role of allowed) {
        const { status } = await api(path, { token: tokens()[role] })
        assert.ok(status < 400, `${role} devrait acceder a ${path} (recu ${status})`)
      }

      for (const role of denied) {
        const { status } = await api(path, { token: tokens()[role] })
        assert.equal(status, 403, `${role} ne devrait pas acceder a ${path}`)
      }
    }
  })
})

describe('Perimetre des donnees', () => {
  it('limite un educateur aux enfants de ses groupes', async () => {
    const { body } = await api('/children', { token: educator.token })
    const names = body.data.map((child) => child.lastName)

    assert.ok(names.includes('Coquelicot'))
    assert.equal(names.includes('Bleuet'), false)
  })

  it('refuse a un educateur la fiche d un enfant hors de ses groupes', async () => {
    const { status } = await api(`/children/${coquelicot.id}`, { token: otherEducator.token })
    assert.equal(status, 403)
  })

  it('limite une famille a son enfant', async () => {
    const mine = await api(`/children/${coquelicot.id}`, { token: family.token })
    const other = await api(`/children/${bleuet.id}`, { token: family.token })

    assert.equal(mine.status, 200)
    assert.equal(other.status, 403)
  })

  it('interdit toute ecriture a une famille', async () => {
    const { status } = await api(`/children/${coquelicot.id}/goals`, {
      method: 'POST',
      token: family.token,
      body: { title: 'Objectif écrit par la famille', domain: 'social' },
    })

    assert.equal(status, 403)
  })

  it("reserve les donnees medicales a l infirmiere et a la direction", async () => {
    const forNurse = await api(`/children/${coquelicot.id}`, { token: nurse.token })
    const forEducator = await api(`/children/${coquelicot.id}`, { token: educator.token })

    assert.equal(forNurse.body.data.referringDoctor.lastName, 'Dupont')
    assert.equal(forEducator.body.data.referringDoctor, null)
    // Le handicap reste visible : l'éducateur en a besoin pour ses séances.
    assert.equal(forEducator.body.data.disability.type, 'autism')
  })
})

describe('Lien de suivi famille', () => {
  it('ouvre la progression sans mot de passe, pour un seul enfant', async () => {
    const created = await api(`/children/${coquelicot.id}/share-link`, {
      method: 'POST',
      token: educator.token,
      body: {},
    })
    assert.equal(created.status, 201)

    const token = created.body.data.token
    const shared = await api(`/share/${token}/progress`)

    assert.equal(shared.status, 200)
    assert.equal(shared.body.meta.child.id, coquelicot.id)

    // Le même jeton ne doit rien ouvrir d'autre.
    const elsewhere = await api('/children', { token })
    assert.equal(elsewhere.status, 401)
  })

  it('refuse un lien falsifie', async () => {
    const { status } = await api('/share/pas-un-jeton/progress')
    assert.equal(status, 401)
  })
})

describe('Gestion des comptes', () => {
  it('cree un compte educateur avec ses groupes', async () => {
    const { status, body } = await api('/users', {
      method: 'POST',
      token: director.token,
      body: {
        email: 'nouvel.educateur@test.local',
        role: 'educator',
        firstName: 'Nouvel',
        lastName: 'Educateur',
        password: 'MotDePasseSolide2026!',
        groups: ['Les Coquelicots'],
      },
    })

    assert.equal(status, 201)
    assert.deepEqual(body.data.groups, ['Les Coquelicots'])
    assert.equal('passwordHash' in body.data, false)
  })

  it('refuse deux comptes sur la meme adresse', async () => {
    const payload = {
      email: 'doublon@test.local',
      role: 'nurse',
      firstName: 'Doublon',
      lastName: 'Test',
      password: 'MotDePasseSolide2026!',
    }

    await api('/users', { method: 'POST', token: director.token, body: payload })
    const { status } = await api('/users', { method: 'POST', token: director.token, body: payload })

    assert.equal(status, 409)
  })

  it('empeche un directeur de se desactiver lui-meme', async () => {
    const { status } = await api(`/users/${director.user.id}`, {
      method: 'DELETE',
      token: director.token,
    })

    assert.equal(status, 409)
  })
})
