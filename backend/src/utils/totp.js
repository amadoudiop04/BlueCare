import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Codes a usage unique bases sur le temps (TOTP, RFC 6238).
 *
 * Compatible avec Google Authenticator, Authy, 1Password, FreeOTP : ces
 * applications implementent toutes le meme standard, il n y a donc rien a
 * installer cote centre.
 *
 * L'algorithme tient en quelques lignes et se verifie contre les vecteurs de
 * test publies dans la RFC (voir `tests/totp.test.js`) : une dependance
 * supplementaire n'apporterait ici ni securite ni lisibilite.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Pas de temps standard : un nouveau code toutes les 30 secondes. */
const STEP_SECONDS = 30
const DIGITS = 6

/** Encode des octets en base32 (RFC 4648), format attendu par les applications. */
export function toBase32(buffer) {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]

  return output
}

export function fromBase32(secret) {
  const clean = String(secret).toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bytes = []
  let bits = 0
  let value = 0

  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char)
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

/** Secret de 20 octets : la taille recommandee par la RFC 4226 pour HMAC-SHA1. */
export function generateSecret() {
  return toBase32(randomBytes(20))
}

/** Numero du pas de temps courant. */
export const stepFor = (date = Date.now()) => Math.floor(date / 1000 / STEP_SECONDS)

/**
 * Code a 6 chiffres pour un pas donne.
 * `algorithm` reste SHA-1 : c est ce que lisent les applications grand public.
 */
export function generateCode(secret, step = stepFor()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))

  const digest = createHmac('sha1', fromBase32(secret)).update(counter).digest()

  // Troncature dynamique : l'offset est porte par les 4 bits de poids faible.
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0')
}

const safeEqual = (a, b) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Verifie un code et rend le pas qui l'a valide, ou `null`.
 *
 * `window` autorise les pas voisins pour absorber le decalage d horloge du
 * telephone : 1 signifie « le pas courant, le precedent et le suivant », soit
 * une tolerance de +/- 30 secondes.
 *
 * Le pas est renvoye pour que l'appelant puisse refuser sa reutilisation : sans
 * cela, un code intercepte reste valable pendant toute sa fenetre.
 */
export function verifyCode(secret, code, { window = 1, at = Date.now() } = {}) {
  const candidate = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(candidate)) return null

  const current = stepFor(at)

  for (let drift = -window; drift <= window; drift += 1) {
    if (safeEqual(candidate, generateCode(secret, current + drift))) return current + drift
  }

  return null
}

/**
 * URI `otpauth://` a encoder en QR code.
 * Le libelle affiche dans l application est `issuer (compte)`.
 */
export function buildOtpAuthUri({ secret, account, issuer }) {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })

  return `otpauth://totp/${label}?${params.toString()}`
}
