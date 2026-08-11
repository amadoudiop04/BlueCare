import { isProduction } from '../config/env.js'

/**
 * Cookie de session.
 *
 * `res.cookie()` et `res.clearCookie()` sont natifs a Express ; seule la
 * LECTURE demande un parseur, d'ou les quelques lignes ci-dessous plutôt
 * qu'une dépendance supplementaire.
 *
 * Trois attributs portent la sécurité :
 *   httpOnly — le jeton est invisible pour JavaScript, donc inatteignable
 *              par une injection de script (ce que localStorage ne permet pas)
 *   sameSite — strict : le cookie n'accompagne aucune requête venue d'un
 *              autre site, ce qui coupe les attaques CSRF a la racine
 *   secure   — en production, le cookie ne circule que sur HTTPS
 */

export const SESSION_COOKIE = 'bluecare_session'

/**
 * Temoin de session, lisible par l'interface.
 *
 * Il ne contient aucun secret — seulement « une session existe » — et sert a
 * une seule chose : permettre au navigateur de savoir s'il vaut la peine
 * d'appeler `GET /auth/me` au démarrage. Sans lui, l'application interrogeait
 * le serveur a chaque ouverture de l'écran de connexion et récoltait un 401
 * parfaitement normal, mais affiche en rouge dans la console — de quoi faire
 * chercher une panne inexistante.
 *
 * Il expire avec la session qu'il annonce. Le jeton, lui, reste `httpOnly` :
 * c'est bien ce cookie-ci qu'un script peut lire, et il n'ouvre rien.
 */
export const SESSION_HINT_COOKIE = 'bluecare_signed_in'

const baseOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: isProduction,
  path: '/',
})

const hintOptions = () => ({ ...baseOptions(), httpOnly: false })

export function setSessionCookie(res, token, expiresAt) {
  const expires = new Date(expiresAt)

  // Le jeton d'abord : des clients lisent le premier cookie de la réponse.
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(), expires })
  res.cookie(SESSION_HINT_COOKIE, '1', { ...hintOptions(), expires })
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, baseOptions())
  res.clearCookie(SESSION_HINT_COOKIE, hintOptions())
}

/** Lit un cookie dans l'en-tête `Cookie` de la requête. */
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
 * Jeton de session porte par la requête.
 *
 * Le cookie d'abord (navigateur), puis `Authorization: Bearer` pour les
 * clients qui n'ont pas de gestionnaire de cookies — tests, Postman, scripts.
 * C'est le même jeton opaque dans les deux cas.
 */
export function readSessionToken(req) {
  const cookie = readSessionCookie(req)
  if (cookie) return cookie

  const header = req.get('authorization')
  if (!header) return null

  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null
}
