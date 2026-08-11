import { createApp } from '../src/app.js'
import { childModel } from '../src/models/child.model.js'
import { resetStore } from '../src/models/memory/store.js'
import { userModel } from '../src/models/user.model.js'
import { hashPassword } from '../src/utils/password.js'

/**
 * Outillage commun aux tests de bout en bout.
 *
 * Ce fichier ne correspond a aucun motif de test (`*.test.js`) : le lanceur
 * `node --test` l'ignore et se contente de l'importer.
 */

const PASSWORD = 'MotDePasse2026!'

export async function startTestServer() {
  // Les tests tournent sur le pilote mémoire : ils ne demandent ni base ni
  // réseau. `createApp` n'amorce plus rien, on repart simplement d'un stock vide.
  resetStore()
  const app = createApp()

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance))
  })

  const baseUrl = `http://127.0.0.1:${server.address().port}/api`

  async function api(path, { method = 'GET', body, token, headers, raw = false } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        // Les tests envoient le jeton de session en Bearer : `fetch` n'a pas
        // de gestionnaire de cookies, contrairement au navigateur.
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (raw) return response

    const isJson = response.headers.get('content-type')?.includes('application/json')

    return { status: response.status, body: isJson ? await response.json() : await response.text() }
  }

  return { server, baseUrl, api, close: () => server.close() }
}

/** Crée un compte et renvoie son jeton d'accès, prêt'à l'emploi. */
export async function createUserWithToken(api, { role, groups = [], childIds = [], email }) {
  const address = email ?? `${role}.${Math.random().toString(36).slice(2, 8)}@test.local`

  await userModel.create({
    email: address,
    role,
    firstName: role,
    lastName: 'Test',
    groups,
    childIds,
    passwordHash: await hashPassword(PASSWORD),
  })

  const { body } = await api('/auth/login', {
    method: 'POST',
    body: { email: address, password: PASSWORD },
  })

  return { email: address, password: PASSWORD, token: body.meta.sessionToken, user: body.data.user }
}

export const childPayload = (overrides = {}) => ({
  firstName: 'Lina',
  lastName: 'Bakayoko',
  birthDate: '2017-04-12',
  group: 'Les Coquelicots',
  disability: { type: 'autism', details: 'Communication verbale limitee.' },
  familyContacts: [
    {
      firstName: 'Aminata',
      lastName: 'Bakayoko',
      relationship: 'mother',
      phone: '+226 70 11 22 33',
      isPrimary: true,
    },
  ],
  referringDoctor: { lastName: 'Dupont', specialty: 'Pedopsychiatrie' },
  ...overrides,
})

/** Crée un enfant sans passer par l API : évite d'avoir besoin d'un directeur. */
export async function createChildDirect(overrides = {}) {
  const { familyContacts, ...rest } = childPayload(overrides)

  return childModel.create({
    ...rest,
    familyContacts,
    status: 'active',
    enrolledAt: '2025-09-01',
    notes: null,
  })
}

export { PASSWORD }
