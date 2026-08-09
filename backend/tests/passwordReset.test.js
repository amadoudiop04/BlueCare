import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'

import { PASSWORD, createUserWithToken, startTestServer } from './helpers.js'
import { userModel } from '../src/models/user.model.js'
import { setMailTransport } from '../src/utils/mailer.js'
import { generateCode, stepFor } from '../src/utils/totp.js'

/**
 * Mot de passe oublié.
 *
 * Deux propriétés structurent ces tests :
 *   - la réponse ne dit jamais si une adresse existe ;
 *   - un lien de réinitialisation ne contourne pas la double authentification.
 * Le reste (usage unique, expiration, fermeture des sessions) en decoule.
 */

let context
let api
let outbox = []

const NEW_PASSWORD = 'NouveauMotDePasse2026!'

/** Le lien envoyé contient le jeton : c'est ainsi que le test le récupère. */
const tokenFromLastMail = () => {
  const mail = outbox.at(-1)
  assert.ok(mail, 'aucun courriel envoye')

  const match = mail.text.match(/\/reinitialisation\/([\w-]+)/)
  assert.ok(match, `lien introuvable dans : ${mail.text}`)

  return match[1]
}

const forgot = (email) => api('/auth/password/forgot', { method: 'POST', body: { email } })

const reset = (token, body) =>
  api(`/auth/password/reset/${token}`, { method: 'POST', body })

const loginWith = (email, password) =>
  api('/auth/login', { method: 'POST', body: { email, password } })

/** Enrôle un compte en 2FA et rend son secret. */
async function enableMfa(account) {
  const setup = await api('/auth/mfa/setup', { method: 'POST', token: account.token })
  const { secret } = setup.body.data

  const enabled = await api('/auth/mfa/enable', {
    method: 'POST',
    token: account.token,
    body: { code: generateCode(secret) },
  })
  assert.equal(enabled.status, 200, JSON.stringify(enabled.body))

  return { secret, recoveryCodes: enabled.body.data.recoveryCodes }
}

// Le code d'activation est marque consommé : on prend le pas suivant, comme
// dans mfa.test.js, encore accepte par la tolérance d'horloge.
const freshCode = (secret) => generateCode(secret, stepFor() + 1)

before(async () => {
  context = await startTestServer()
  api = context.api

  // Transport de test : rien ne part, on lit ce qui serait parti.
  setMailTransport({
    name: 'test',
    async send(message) {
      outbox.push(message)
      return { delivered: true, transport: 'test' }
    },
  })
})

after(() => {
  setMailTransport(null)
  context?.close()
})

beforeEach(() => {
  outbox = []
})

describe('Demande de reinitialisation', () => {
  it('repond pareil pour une adresse inconnue, et n envoie rien', async () => {
    const response = await forgot('personne@papillonbleu.test')

    assert.equal(response.status, 200)
    assert.equal(response.body.data.requested, true)
    assert.equal(outbox.length, 0)
  })

  it('envoie un lien a un compte actif', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const response = await forgot(account.email)

    assert.equal(response.status, 200)
    // Réponse identique au cas inconnu : rien ne distingue les deux.
    assert.deepEqual(response.body.data, { requested: true })
    assert.equal(outbox.length, 1)
    assert.equal(outbox[0].to, account.email)
  })

  it('ignore la casse et les espaces de l adresse', async () => {
    const account = await createUserWithToken(api, { role: 'nurse' })

    const response = await forgot(`  ${account.email.toUpperCase()}  `)

    assert.equal(response.status, 200)
    assert.equal(outbox.length, 1)
  })

  it('n envoie rien a un compte desactive', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await userModel.update(account.user.id, { status: 'inactive' })

    const response = await forgot(account.email)

    assert.equal(response.status, 200)
    assert.equal(outbox.length, 0)
  })

  it('invalide le lien precedent quand on en redemande un', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    await forgot(account.email)
    const first = tokenFromLastMail()

    await forgot(account.email)
    const second = tokenFromLastMail()
    assert.notEqual(first, second)

    const stale = await reset(first, { password: NEW_PASSWORD })
    assert.equal(stale.status, 400)

    const fresh = await reset(second, { password: NEW_PASSWORD })
    assert.equal(fresh.status, 200)
  })

  it('limite le nombre de demandes pour une meme adresse', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    // Cinq demandes passent, la sixieme est refusee : on ne peut pas inonder
    // la boite de quelqu'un en rejouant le formulaire.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await forgot(account.email)).status, 200)
    }

    const blocked = await forgot(account.email)
    assert.equal(blocked.status, 429)
    assert.equal(outbox.length, 5)
  })

  it('ne stocke jamais le jeton en clair', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await forgot(account.email)

    const stored = await userModel.findByIdWithSecret(account.user.id)

    assert.ok(stored.resetTokenHash)
    assert.notEqual(stored.resetTokenHash, tokenFromLastMail())
  })
})

describe('Verification du lien', () => {
  it('decrit un lien valable sans rien reveler du compte', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await forgot(account.email)

    const { status, body } = await api(`/auth/password/reset/${tokenFromLastMail()}`)

    assert.equal(status, 200)
    assert.equal(body.data.valid, true)
    assert.equal(body.data.mfaRequired, false)
    // Ni adresse ni identité : le lien a pu être transfere ou intercepte.
    assert.deepEqual(Object.keys(body.data).sort(), ['mfaRequired', 'valid'])
  })

  it('refuse un jeton inconnu', async () => {
    const { status, body } = await api('/auth/password/reset/nimportequoi')

    assert.equal(status, 200)
    assert.equal(body.data.valid, false)
  })

  it('refuse un lien expire', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await forgot(account.email)
    const token = tokenFromLastMail()

    await userModel.update(account.user.id, {
      resetExpiresAt: new Date(Date.now() - 1000).toISOString(),
    })

    const { body } = await api(`/auth/password/reset/${token}`)
    assert.equal(body.data.valid, false)

    const used = await reset(token, { password: NEW_PASSWORD })
    assert.equal(used.status, 400)
  })
})

describe('Reinitialisation', () => {
  it('remplace le mot de passe et invalide l ancien', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await forgot(account.email)

    const response = await reset(tokenFromLastMail(), { password: NEW_PASSWORD })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal(response.body.data.reset, true)

    const withOld = await loginWith(account.email, PASSWORD)
    assert.equal(withOld.status, 401)

    const withNew = await loginWith(account.email, NEW_PASSWORD)
    assert.equal(withNew.status, 200)
  })

  it('ferme toutes les sessions ouvertes', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })

    const before = await api('/auth/me', { token: account.token })
    assert.equal(before.status, 200)

    await forgot(account.email)
    await reset(tokenFromLastMail(), { password: NEW_PASSWORD })

    // Si le compte etait compromis, laisser l'intrus connecte n'aurait pas de sens.
    const after = await api('/auth/me', { token: account.token })
    assert.equal(after.status, 401)
  })

  it('ne sert qu une fois', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await forgot(account.email)
    const token = tokenFromLastMail()

    assert.equal((await reset(token, { password: NEW_PASSWORD })).status, 200)

    const replay = await reset(token, { password: 'EncoreUnAutre2026!' })
    assert.equal(replay.status, 400)
  })

  it('applique la politique de mot de passe', async () => {
    const account = await createUserWithToken(api, { role: 'educator' })
    await forgot(account.email)
    const token = tokenFromLastMail()

    const tooShort = await reset(token, { password: 'court' })
    assert.equal(tooShort.status, 400)
    assert.ok(tooShort.body.details.password)

    // Le lien reste utilisable : la saisie etait invalide, pas le lien.
    assert.equal((await reset(token, { password: NEW_PASSWORD })).status, 200)
  })

  it('refuse un jeton inconnu', async () => {
    const response = await reset('jeton-invente', { password: NEW_PASSWORD })
    assert.equal(response.status, 400)
  })
})

describe('Reinitialisation avec double authentification', () => {
  it('annonce que le code sera demande', async () => {
    const account = await createUserWithToken(api, { role: 'director' })
    await enableMfa(account)
    await forgot(account.email)

    const { body } = await api(`/auth/password/reset/${tokenFromLastMail()}`)

    assert.equal(body.data.valid, true)
    assert.equal(body.data.mfaRequired, true)
  })

  it('refuse de reinitialiser sans le second facteur', async () => {
    const account = await createUserWithToken(api, { role: 'director' })
    await enableMfa(account)
    await forgot(account.email)
    const token = tokenFromLastMail()

    // Le point central : l'accès'a la boite mail ne suffit pas a prendre le
    // compte, sinon la double authentification ne protegerait plus de rien.
    const withoutCode = await reset(token, { password: NEW_PASSWORD })
    assert.equal(withoutCode.status, 400)

    const wrongCode = await reset(token, { password: NEW_PASSWORD, code: '000000' })
    assert.equal(wrongCode.status, 401)

    // Le mot de passe d'origine reste le bon.
    const login = await loginWith(account.email, NEW_PASSWORD)
    assert.equal(login.status, 401)
  })

  it('accepte avec un code valide', async () => {
    const account = await createUserWithToken(api, { role: 'director' })
    const { secret } = await enableMfa(account)
    await forgot(account.email)

    const response = await reset(tokenFromLastMail(), {
      password: NEW_PASSWORD,
      code: freshCode(secret),
    })

    assert.equal(response.status, 200, JSON.stringify(response.body))

    // La 2FA reste active : elle est demandée a la connexion suivante.
    const login = await loginWith(account.email, NEW_PASSWORD)
    assert.equal(login.status, 200)
    assert.equal(login.body.data.mfaRequired, true)
  })

  it('accepte un code de secours', async () => {
    const account = await createUserWithToken(api, { role: 'director' })
    const { recoveryCodes } = await enableMfa(account)
    await forgot(account.email)

    const response = await reset(tokenFromLastMail(), {
      password: NEW_PASSWORD,
      code: recoveryCodes[0],
    })

    assert.equal(response.status, 200, JSON.stringify(response.body))

    // Le code de secours est consommé : il ne peut pas resservir.
    await forgot(account.email)
    const replay = await reset(tokenFromLastMail(), {
      password: 'EncoreUnAutre2026!',
      code: recoveryCodes[0],
    })
    assert.equal(replay.status, 401)
  })
})
