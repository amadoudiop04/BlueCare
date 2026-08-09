import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildOtpAuthUri,
  fromBase32,
  generateCode,
  generateSecret,
  stepFor,
  toBase32,
  verifyCode,
} from '../src/utils/totp.js'

/**
 * Les vecteurs de la RFC 6238 (annexe B) utilisent le secret ASCII
 * « 12345678901234567890 ». On le convertit en base32 pour interroger notre
 * implementation avec exactement les mêmes entrees que la norme.
 */
const RFC_SECRET = toBase32(Buffer.from('12345678901234567890', 'ascii'))

describe('base32', () => {
  it('encode et decode sans perte', () => {
    const original = Buffer.from('12345678901234567890', 'ascii')
    assert.equal(fromBase32(toBase32(original)).toString('ascii'), original.toString('ascii'))
  })

  it('ignore les espaces et la casse a la lecture', () => {
    assert.deepEqual(fromBase32('gezd gnbv gy3t qoj q'), fromBase32('GEZDGNBVGY3TQOJQ'))
  })

  it('produit un secret de 32 caracteres base32 (160 bits)', () => {
    assert.match(generateSecret(), /^[A-Z2-7]{32}$/)
  })
})

describe('generateCode — vecteurs de la RFC 6238', () => {
  // [horodatage unix, code SHA-1 attendu]
  const VECTORS = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ]

  for (const [seconds, expected] of VECTORS) {
    it(`t=${seconds} donne ${expected}`, () => {
      assert.equal(generateCode(RFC_SECRET, stepFor(seconds * 1000)), expected)
    })
  }
})

describe('verifyCode', () => {
  const at = 1111111109 * 1000

  it('accepte le code du pas courant et rend son numero', () => {
    const step = verifyCode(RFC_SECRET, '081804', { at })
    assert.equal(step, stepFor(at))
  })

  it('tolere un pas de decalage dans chaque sens', () => {
    const previous = generateCode(RFC_SECRET, stepFor(at) - 1)
    const next = generateCode(RFC_SECRET, stepFor(at) + 1)

    assert.equal(verifyCode(RFC_SECRET, previous, { at }), stepFor(at) - 1)
    assert.equal(verifyCode(RFC_SECRET, next, { at }), stepFor(at) + 1)
  })

  it('refuse au-dela de la fenetre', () => {
    const faraway = generateCode(RFC_SECRET, stepFor(at) + 5)
    assert.equal(verifyCode(RFC_SECRET, faraway, { at }), null)
  })

  it('refuse un code mal forme', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', null, undefined, '12 34 56 78']) {
      assert.equal(verifyCode(RFC_SECRET, bad, { at }), null)
    }
  })

  it('accepte un code saisi avec des espaces', () => {
    assert.equal(verifyCode(RFC_SECRET, '081 804', { at }), stepFor(at))
  })

  it('refuse le code d un autre secret', () => {
    assert.equal(verifyCode(generateSecret(), '081804', { at }), null)
  })
})

describe('buildOtpAuthUri', () => {
  it('produit une URI lisible par les applications d authentification', () => {
    const uri = buildOtpAuthUri({
      secret: RFC_SECRET,
      account: 'directrice@papillonbleu.test',
      issuer: 'BlueCare',
    })

    assert.match(uri, /^otpauth:\/\/totp\//)
    assert.ok(uri.includes(`secret=${RFC_SECRET}`))
    assert.ok(uri.includes('issuer=BlueCare'))
    assert.ok(uri.includes('digits=6'))
    assert.ok(uri.includes('period=30'))
  })
})
