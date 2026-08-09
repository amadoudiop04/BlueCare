import { isProduction } from '../config/env.js'

/**
 * Cookie de session.
 *
 * `res.cookie()` et `res.clearCookie()` sont natifs a Express ; seule la
 * LECTURE demande un parseur, d ou les quelques lignes ci-dessous plutot
 * qu une dependance supplementaire.
 *
 * Trois attributs portent la securite :
 *   httpOnly — le jeton est invisible pour JavaScript, donc inatteignable
 *              par une injection de script (ce que localStorage ne permet pas)
 *   sameSite — strict : le cookie n'accompagne aucune requete venue d'un
 *              autre site, ce qui coupe les attaques CSRF a la racine
 *   secure   — en production, le cookie ne circule que sur HTTPS
 */

export const SESSION_COOKIE = 'bluecare_session'

const baseOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: isProduction,
  path: '/',
})

export function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    ...baseOptions(),
    expires: new Date(expiresAt),
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, baseOptions())
}

/** Lit un cookie dans l'en-tete `Cookie` de la requete. */
function readCookie(req, name) {
  const header = req.get('cookie')
  if (!header) return null

  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue

    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim())
    }
  }

  return null
}

const readSessionCookie = (req) => readCookie(req, SESSION_COOKIE)

/**
 * Jeton de session porte par la requete.
 *
 * Le cookie d'abord (navigateur), puis `Authorization: Bearer` pour les
 * clients qui n ont pas de gestionnaire de cookies — tests, Postman, scripts.
 * C est le meme jeton opaque dans les deux cas.
 */
export function readSessionToken(req) {
  const cookie = readSessionCookie(req)
  if (cookie) return cookie

  const header = req.get('authorization')
  if (!header) return null

  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null
}
