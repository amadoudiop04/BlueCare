import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { childPayload, createUserWithToken, startTestServer } from './helpers.js'
import { addDays, today } from '../src/utils/dates.js'

/**
 * Tests de bout en bout des fiches enfants, presences et galerie.
 * On demarre l'app sur un port libre et on l'appelle en HTTP : aucune
 * dependance de test supplementaire, `fetch` suffit.
 */

let context
let api
let director
let educator

const asDirector = (path, options = {}) => api(path, { ...options, token: director.token })

async function createChild(overrides) {
  const { status, body } = await asDirector('/children', {
    method: 'POST',
    body: childPayload(overrides),
  })
  assert.equal(status, 201, JSON.stringify(body))
  return body.data
}

before(async () => {
  context = await startTestServer()
  api = context.api

  director = await createUserWithToken(api, { role: 'director' })
  educator = await createUserWithToken(api, {
    role: 'educator',
    groups: ['Les Coquelicots', 'Les Bleuets', 'Groupe Bulk', 'Groupe Invalide', 'Groupe Oubli'],
  })
})

after(() => context?.close())

describe('Fiches enfants', () => {
  it('cree une fiche complete et la relit', async () => {
    const created = await createChild({ lastName: 'Cree' })

    assert.match(created.id, /^chd_/)
    assert.equal(created.status, 'active')
    assert.equal(created.disability.type, 'autism')
    assert.equal(created.familyContacts[0].isPrimary, true)
    assert.equal(created.referringDoctor.lastName, 'Dupont')

    const { status, body } = await asDirector(`/children/${created.id}`)
    assert.equal(status, 200)
    assert.equal(body.data.displayName, 'Lina Cree')
    assert.equal(typeof body.data.age, 'number')
  })

  it('refuse une fiche incomplete en listant tous les champs fautifs', async () => {
    const { status, body } = await asDirector('/children', {
      method: 'POST',
      body: { firstName: 'Lina', birthDate: '2050-01-01', disability: { type: 'inconnu' } },
    })

    assert.equal(status, 400)
    assert.ok(body.details.lastName)
    assert.ok(body.details.birthDate)
    assert.ok(body.details.group)
    assert.ok(body.details['disability.type'])
    assert.ok(body.details.familyContacts)
  })

  it('valide les contacts famille champ par champ', async () => {
    const { status, body } = await asDirector('/children', {
      method: 'POST',
      body: childPayload({
        familyContacts: [{ lastName: 'Bakayoko', relationship: 'cousin', phone: 'abc' }],
      }),
    })

    assert.equal(status, 400)
    assert.ok(body.details['familyContacts.0.relationship'])
    assert.ok(body.details['familyContacts.0.phone'])
  })

  it('refuse deux fiches pour le meme enfant', async () => {
    await createChild({ lastName: 'Doublon' })
    const { status, body } = await asDirector('/children', {
      method: 'POST',
      body: childPayload({ lastName: 'Doublon' }),
    })

    assert.equal(status, 409)
    assert.ok(body.details.childId)
  })

  it('met a jour partiellement sans effacer le reste', async () => {
    const child = await createChild({ lastName: 'Patch' })
    const { status, body } = await asDirector(`/children/${child.id}`, {
      method: 'PATCH',
      body: { group: 'Les Bleuets' },
    })

    assert.equal(status, 200)
    assert.equal(body.data.group, 'Les Bleuets')
    assert.equal(body.data.firstName, 'Lina')
    assert.equal(body.data.disability.type, 'autism')
  })

  it('archive au lieu de supprimer', async () => {
    const child = await createChild({ lastName: 'Archive' })
    const { status, body } = await asDirector(`/children/${child.id}`, { method: 'DELETE' })

    assert.equal(status, 200)
    assert.equal(body.data.status, 'archived')

    // La fiche existe toujours, elle sort seulement de la liste par defaut.
    assert.equal((await asDirector(`/children/${child.id}`)).status, 200)

    const listed = await asDirector('/children?pageSize=100')
    assert.equal(listed.body.data.some((entry) => entry.id === child.id), false)
  })

  it('filtre et pagine la liste', async () => {
    await createChild({ firstName: 'Sofia', lastName: 'Filtre', group: 'Les Bleuets' })

    const filtered = await asDirector('/children?group=Les Bleuets&pageSize=100')
    assert.equal(filtered.status, 200)
    assert.ok(filtered.body.data.every((child) => child.group === 'Les Bleuets'))
    assert.equal(filtered.body.meta.pagination.pageSize, 100)
  })

  it('repond 404 sur un enfant inconnu', async () => {
    assert.equal((await asDirector('/children/chd_inconnu')).status, 404)
  })
})

describe('Presences quotidiennes', () => {
  const asEducator = (path, options = {}) => api(path, { ...options, token: educator.token })

  it('enregistre une presence puis corrige la saisie sans doublon', async () => {
    const child = await createChild({ lastName: 'Presence' })

    const created = await asEducator('/attendance', {
      method: 'POST',
      body: { childId: child.id, date: today(), status: 'present', arrivalTime: '08:45' },
    })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.equal(created.body.data.status, 'present')

    const corrected = await asEducator('/attendance', {
      method: 'POST',
      body: { childId: child.id, date: today(), status: 'excused', reason: 'Rendez-vous medical' },
    })
    assert.equal(corrected.status, 201)
    assert.equal(corrected.body.data.id, created.body.data.id)

    const history = await asEducator(`/children/${child.id}/attendance`)
    assert.equal(history.body.data.records.length, 1)
    assert.equal(history.body.data.summary.excused, 1)
  })

  it('exige un motif pour une absence justifiee et une heure pour un retard', async () => {
    const child = await createChild({ lastName: 'Motif' })

    const excused = await asEducator('/attendance', {
      method: 'POST',
      body: { childId: child.id, date: today(), status: 'excused' },
    })
    assert.equal(excused.status, 400)
    assert.ok(excused.body.details.reason)

    const late = await asEducator('/attendance', {
      method: 'POST',
      body: { childId: child.id, date: today(), status: 'late' },
    })
    assert.equal(late.status, 400)
    assert.ok(late.body.details.arrivalTime)
  })

  it('refuse une saisie dans le futur', async () => {
    const child = await createChild({ lastName: 'Futur' })
    const { status, body } = await asEducator('/attendance', {
      method: 'POST',
      body: { childId: child.id, date: addDays(today(), 1), status: 'present' },
    })

    assert.equal(status, 400)
    assert.ok(body.details.date)
  })

  it('remonte une alerte des le seuil d absences consecutives atteint', async () => {
    const child = await createChild({ lastName: 'Alerte' })

    const responses = []
    for (const offset of [2, 1, 0]) {
      responses.push(
        await asEducator('/attendance', {
          method: 'POST',
          body: { childId: child.id, date: addDays(today(), -offset), status: 'absent' },
        }),
      )
    }

    // Deux absences ne suffisent pas, la troisieme declenche l'alerte.
    assert.deepEqual(responses[1].body.meta.alerts, [])

    const rules = responses[2].body.meta.alerts.map((alert) => alert.rule)
    assert.ok(rules.includes('consecutive-absences'))

    const alerts = await asEducator('/attendance/alerts')
    const entry = alerts.body.data.find((item) => item.child.id === child.id)
    assert.ok(entry, "l enfant doit apparaitre dans le tableau des alertes")
    assert.equal(entry.summary.absent, 3)
  })

  it('saisit la feuille d appel d un groupe en une requete', async () => {
    const first = await createChild({ firstName: 'Adam', lastName: 'Bulk', group: 'Groupe Bulk' })
    const second = await createChild({ firstName: 'Elsa', lastName: 'Bulk', group: 'Groupe Bulk' })

    const { status, body } = await asEducator('/attendance/bulk', {
      method: 'POST',
      body: {
        date: today(),
        recordedBy: 'Infirmiere',
        records: [
          { childId: first.id, status: 'present' },
          { childId: second.id, status: 'late', arrivalTime: '09:20' },
        ],
      },
    })

    assert.equal(status, 201, JSON.stringify(body))
    assert.equal(body.data.length, 2)
    assert.equal(body.data[0].recordedBy, 'Infirmiere')

    const sheet = await asEducator(`/attendance?date=${today()}&group=Groupe Bulk`)
    assert.equal(sheet.body.data.summary.total, 2)
    assert.equal(sheet.body.data.summary.missing, 0)
    assert.equal(sheet.body.data.summary.late, 1)
  })

  it('rejette toute la saisie groupee si une ligne est invalide', async () => {
    const child = await createChild({ lastName: 'BulkInvalide', group: 'Groupe Invalide' })

    const { status, body } = await asEducator('/attendance/bulk', {
      method: 'POST',
      body: {
        date: today(),
        records: [
          { childId: child.id, status: 'present' },
          { childId: child.id, status: 'statut-inconnu' },
        ],
      },
    })

    assert.equal(status, 400)
    assert.ok(body.details['records.1.status'])

    const sheet = await asEducator(`/attendance?date=${today()}&group=Groupe Invalide`)
    assert.equal(sheet.body.data.summary.missing, 1)
  })

  it('signale les enfants sans saisie sur la feuille du jour', async () => {
    await createChild({ lastName: 'Oublie', group: 'Groupe Oubli' })

    const { body } = await asEducator(`/attendance?date=${today()}&group=Groupe Oubli`)
    assert.equal(body.data.summary.missing, 1)
    assert.equal(body.data.entries[0].record, null)
  })

  it('refuse une saisie sur une fiche archivee', async () => {
    const child = await createChild({ lastName: 'ArchivePresence' })
    await asDirector(`/children/${child.id}`, { method: 'DELETE' })

    const { status } = await asEducator('/attendance', {
      method: 'POST',
      body: { childId: child.id, date: today(), status: 'present' },
    })

    assert.equal(status, 409)
  })

  it('annule une saisie erronee', async () => {
    const child = await createChild({ lastName: 'Annulation' })
    await asEducator('/attendance', {
      method: 'POST',
      body: { childId: child.id, date: today(), status: 'present' },
    })

    const removed = await asEducator(`/attendance/${child.id}/${today()}`, { method: 'DELETE' })
    assert.equal(removed.status, 200)

    const history = await asEducator(`/children/${child.id}/attendance`)
    assert.equal(history.body.data.records.length, 0)

    const again = await asEducator(`/attendance/${child.id}/${today()}`, { method: 'DELETE' })
    assert.equal(again.status, 404)
  })
})

describe('Galerie d activites anonymisee', () => {
  const asEducator = (path, options = {}) => api(path, { ...options, token: educator.token })

  it('anonymise les autres participants, y compris dans les textes', async () => {
    const lina = await createChild({ firstName: 'Lina', lastName: 'Galerie' })
    const malik = await createChild({ firstName: 'Malik', lastName: 'Ferrand' })

    const created = await asEducator('/activities', {
      method: 'POST',
      body: {
        title: 'Atelier peinture',
        category: 'arts',
        date: today(),
        group: 'Les Coquelicots',
        description: 'Lina a choisi les couleurs et Malik Ferrand a peint l arbre.',
        participantIds: [lina.id, malik.id],
        media: [{ url: '/media/fresque.jpg', caption: 'Malik devant son arbre' }],
        createdBy: 'Educateur referent',
      },
    })
    assert.equal(created.status, 201, JSON.stringify(created.body))

    const { status, body } = await asEducator(`/children/${lina.id}/gallery`)
    assert.equal(status, 200)

    const item = body.data.find((entry) => entry.id === created.body.data.id)
    assert.ok(item)
    assert.equal(item.description.includes('Malik'), false)
    assert.equal(item.description.includes('Ferrand'), false)
    assert.equal(item.description.includes('Lina'), true)
    assert.equal(item.media[0].caption.includes('Malik'), false)
    assert.equal(item.participantCount, 2)
    assert.equal(JSON.stringify(item).includes(malik.id), false)
    assert.equal('createdBy' in item, false)
  })

  it('donne des aliases differents d une activite a l autre', async () => {
    const sujet = await createChild({ firstName: 'Sofia', lastName: 'Alias' })
    const autre = await createChild({ firstName: 'Adam', lastName: 'Alias' })

    for (const title of ['Premiere sortie', 'Seconde sortie']) {
      await asEducator('/activities', {
        method: 'POST',
        body: { title, category: 'outing', date: today(), participantIds: [sujet.id, autre.id] },
      })
    }

    const { body } = await asEducator(`/children/${sujet.id}/gallery`)
    const galleries = body.data.filter((item) => item.title.endsWith('sortie'))
    assert.equal(galleries.length, 2)

    const aliasIn = (item) => item.participants.find((entry) => !entry.isSubject).alias
    assert.notEqual(aliasIn(galleries[0]), aliasIn(galleries[1]))
  })

  it('refuse une activite avec un participant inconnu', async () => {
    const { status, body } = await asEducator('/activities', {
      method: 'POST',
      body: {
        title: 'Atelier fantome',
        category: 'arts',
        date: today(),
        participantIds: ['chd_inconnu'],
      },
    })

    assert.equal(status, 400)
    assert.ok(body.details.participantIds)
  })

  it('refuse de modifier une activite hors perimetre', async () => {
    const outsider = await createUserWithToken(api, {
      role: 'educator',
      groups: ['Groupe sans activite'],
    })
    const child = await createChild({ firstName: 'Ilan', lastName: 'Perimetre' })

    const created = await asDirector('/activities', {
      method: 'POST',
      body: {
        title: 'Atelier reserve',
        category: 'arts',
        date: today(),
        participantIds: [child.id],
      },
    })

    for (const method of ['PATCH', 'DELETE']) {
      const { status } = await api(`/activities/${created.body.data.id}`, {
        method,
        token: outsider.token,
        body: method === 'PATCH' ? { title: 'Detourne' } : undefined,
      })
      assert.equal(status, 403, `${method} devrait etre refuse hors perimetre`)
    }
  })

  it('ne renvoie que les activites de l enfant', async () => {
    const child = await createChild({ firstName: 'Noe', lastName: 'Solo' })
    const other = await createChild({ firstName: 'Ines', lastName: 'Solo' })

    await asEducator('/activities', {
      method: 'POST',
      body: { title: 'Sans Noe', category: 'music', date: today(), participantIds: [other.id] },
    })

    const { body } = await asEducator(`/children/${child.id}/gallery`)
    assert.equal(body.data.some((item) => item.title === 'Sans Noe'), false)
  })
})

describe('Referentiel', () => {
  it('expose les listes de valeurs et les seuils d alerte', async () => {
    const { status, body } = await asDirector('/reference')

    assert.equal(status, 200)
    assert.ok(body.data.disabilityTypes.some((option) => option.value === 'autism'))
    assert.ok(body.data.attendanceStatuses.some((option) => option.value === 'excused'))
    assert.equal(typeof body.data.attendanceAlertRules.consecutiveThreshold, 'number')
    assert.ok(Array.isArray(body.data.groups))
  })
})
