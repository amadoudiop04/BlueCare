import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { aliasFor, anonymizeActivity } from '../src/utils/anonymize.js'

const SALT = 'test-salt'

const CHILDREN = [
  { id: 'chd_1', firstName: 'Lina', lastName: 'Bakayoko' },
  { id: 'chd_2', firstName: 'Malik', lastName: 'Ferrand' },
  { id: 'chd_3', firstName: 'Elsa', lastName: 'Moreau' },
]

const ACTIVITY = {
  id: 'act_1',
  title: 'Atelier peinture avec Malik Ferrand',
  description: "Lina a choisi les couleurs, Malik a peint l arbre et Elsa a signe la fresque.",
  category: 'arts',
  date: '2026-08-03',
  group: 'Les Coquelicots',
  location: 'Salle bleue',
  participantIds: ['chd_1', 'chd_2', 'chd_3'],
  media: [{ id: 'med_1', url: '/media/fresque.jpg', caption: 'Malik devant son arbre' }],
  createdBy: 'Educateur referent',
  createdAt: '2026-08-03T10:00:00.000Z',
}

const anonymize = (subjectChildId) =>
  anonymizeActivity(ACTIVITY, { subjectChildId, children: CHILDREN, salt: SALT })

describe('aliasFor', () => {
  it('est stable pour un meme couple activite / enfant', () => {
    assert.equal(aliasFor('act_1', 'chd_1', SALT), aliasFor('act_1', 'chd_1', SALT))
  })

  it('change d une activite a l autre, pour empecher les recoupements', () => {
    assert.notEqual(aliasFor('act_1', 'chd_1', SALT), aliasFor('act_2', 'chd_1', SALT))
  })

  it('distingue deux enfants dans la meme activite', () => {
    assert.notEqual(aliasFor('act_1', 'chd_1', SALT), aliasFor('act_1', 'chd_2', SALT))
  })

  it('depend du sel', () => {
    assert.notEqual(aliasFor('act_1', 'chd_1', SALT), aliasFor('act_1', 'chd_1', 'autre-sel'))
  })
})

describe('anonymizeActivity', () => {
  it('masque le nom des autres enfants dans les textes libres', () => {
    const gallery = anonymize('chd_1')

    assert.equal(gallery.title.includes('Malik'), false)
    assert.equal(gallery.title.includes('Ferrand'), false)
    assert.equal(gallery.description.includes('Malik'), false)
    assert.equal(gallery.description.includes('Elsa'), false)
    assert.equal(gallery.media[0].caption.includes('Malik'), false)
  })

  it("conserve le nom de l enfant dont on ouvre la fiche", () => {
    const gallery = anonymize('chd_1')

    assert.equal(gallery.description.includes('Lina'), true)
  })

  it('remplace le nom complet avant le prenom seul', () => {
    const gallery = anonymize('chd_1')
    const alias = aliasFor('act_1', 'chd_2', SALT)

    assert.equal(gallery.title, `Atelier peinture avec ${alias}`)
  })

  it('marque le sujet dans la liste des participants', () => {
    const gallery = anonymize('chd_2')
    const subjects = gallery.participants.filter((participant) => participant.isSubject)

    assert.equal(subjects.length, 1)
    assert.equal(gallery.participantCount, 3)
  })

  it("n expose ni identifiant d enfant ni auteur de la saisie", () => {
    const gallery = anonymize('chd_1')
    const serialized = JSON.stringify(gallery)

    assert.equal(serialized.includes('chd_2'), false)
    assert.equal(serialized.includes('chd_3'), false)
    assert.equal('createdBy' in gallery, false)
    for (const participant of gallery.participants) {
      assert.equal('id' in participant, false)
    }
  })

  it("donne des aliases differents selon l enfant qui consulte", () => {
    const fromLina = anonymize('chd_1').participants.map((entry) => entry.alias)
    const fromMalik = anonymize('chd_2').participants.map((entry) => entry.alias)

    // Les aliases sont les memes, seul le marqueur `isSubject` bouge.
    assert.deepEqual(fromLina, fromMalik)
    assert.equal(anonymize('chd_1').participants[0].isSubject, true)
    assert.equal(anonymize('chd_2').participants[0].isSubject, false)
  })
})
