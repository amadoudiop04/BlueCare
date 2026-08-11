import { env } from '../config/env.js'
import { authSessionModel } from '../models/authSession.model.js'
import { createSessionToken, hashSessionToken } from '../utils/sessionToken.js'

/**
 * Cycle de vie des sessions de connexion.
 *
 * Le jeton n'existe en clair qu'a deux instants : quand il est crée (envoyé
 * dans le cookie) et quand il revient dans une requête. En base, seul son
 * hachage est conserve.
 *
 * Expiration glissante : chaque requête repousse l'échéance, une session
 * inactive s'eteint donc d'elle-même. Une borne absolue évite qu'un poste
 * jamais déconnecte reste ouvert indefiniment.
 */

const minutes = (value) => value * 60_000

/** Coupe l'user-agent : on veut reconnaitre un appareil, pas l'archiver. */
const shortUserAgent = (value) => (typeof value === 'string' ? value.slice(0, 200) : null)

export const sessionAuthService = {
  /** Ouvre une session et rend le jeton en clair, une seule fois. */
  async open(user, request = {}) {
    // Menage opportuniste : évite une tache planifiée pour si peu.
    await authSessionModel.removeExpired().catch(() => 0)

    const token = createSessionToken()
    const now = Date.now()

    const session = await authSessionModel.create({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      userAgent: shortUserAgent(request.userAgent),
      ip: request.ip ?? null,
      lastSeenAt: new Date(now).toISOString(),
      expiresAt: new Date(now + minutes(env.session.idleMinutes)).toISOString(),
      absoluteExpiresAt: new Date(now + minutes(env.session.absoluteMinutes)).toISOString(),
    })

    return { token, session }
  },

  /**
   * Retrouve la session d'un jeton et repousse son échéance.
   * Rend `null` si le jeton est inconnu ou la session expiree.
   */
  async resolve(token) {
    if (!token) return null

    const session = await authSessionModel.findByTokenHash(hashSessionToken(token))
    if (!session) return null

    const now = Date.now()
    const expired =
      new Date(session.expiresAt).getTime() <= now ||
      (session.absoluteExpiresAt && new Date(session.absoluteExpiresAt).getTime() <= now)

    if (expired) {
      await authSessionModel.remove(session.id)
      return null
    }

    const nextExpiry = new Date(now + minutes(env.session.idleMinutes)).toISOString()

    // On n'écrit que si l'échéance bouge vraiment : sans ce garde-fou, chaque
    // requête de chaque utilisateur ferait un UPDATE.
    const stale = new Date(session.lastSeenAt).getTime() < now - minutes(env.session.touchMinutes)

    if (stale) {
      await authSessionModel.touch(session.id, {
        lastSeenAt: new Date(now).toISOString(),
        expiresAt: nextExpiry,
      })
    }

    return { ...session, expiresAt: stale ? nextExpiry : session.expiresAt }
  },

  close: (sessionId) => authSessionModel.remove(sessionId),

  closeOthers: (userId, currentSessionId) =>
    authSessionModel.removeForUser(userId, { except: currentSessionId }),

  closeAll: (userId) => authSessionModel.removeForUser(userId),

  /** Appareils connectes, sans jamais exposer le hachage du jeton. */
  async list(userId, currentSessionId) {
    const sessions = await authSessionModel.listForUser(userId)

    return sessions.map(({ tokenHash, ...session }) => ({
      ...session,
      current: session.id === currentSessionId,
    }))
  },
}
