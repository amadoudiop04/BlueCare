import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'

/**
 * Codes de secours de la double authentification.
 *
 * Un téléphone perdu ne doit pas enfermer une infirmière dehors un dimanche.
 * Ces codes sont montrés une seule fois, a l'activation, puis seuls leurs
 * hachages sont conservés — comme un mot de passe. Chacun ne sert qu'une fois.
 */

const COUNT = 8
const GROUP = 4

/** `A3F2-9K1D` : lisible a voix haute, sans caractères ambigus (0/O, 1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode() {
  const bytes = randomBytes(GROUP * 2)
  const letters = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length])

  return `${letters.slice(0, GROUP).join('')}-${letters.slice(GROUP).join('')}`
}

/**
 * Rend les codes en clair (a montrer une fois) et leurs hachages (a stocker).
 * Le coût bcrypt est volontairement plus faible que pour un mot de passe : ces
 * codes font 40 bits d'entropie chacun et sont à usage unique.
 */
export function generateRecoveryCodes() {
  const codes = Array.from({ length: COUNT }, randomCode)

  return {
    codes,
    hashes: codes.map((code) => bcrypt.hashSync(code, 8)),
  }
}

const normalize = (code) => String(code ?? '').trim().toUpperCase().replace(/\s/g, '')

/**
 * Cherche le code parmi les hachages restants.
 * Rend la liste amputee du code consommé, ou `null` si aucun ne correspond.
 */
export function consumeRecoveryCode(code, hashes = []) {
  const candidate = normalize(code)
  if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(candidate)) return null

  const withDash = candidate.includes('-')
    ? candidate
    : `${candidate.slice(0, GROUP)}-${candidate.slice(GROUP)}`

  const index = hashes.findIndex((hash) => bcrypt.compareSync(withDash, hash))
  if (index === -1) return null

  return hashes.filter((_, position) => position !== index)
}
