/**
 * Limiteur de cadence minimal, en mémoire.
 *
 * Il protege la demande de réinitialisation : sans lui, n'importe qui pourrait
 * déclencher un envoi en boucle vers l'adresse d'un collegue. Ce n'est pas une
 * defense contre un attaquant distribue — la mémoire n'est pas partagee entre
 * plusieurs processus — mais cela suffit a empêcher le harcelement par courriel
 * et l'exploration systematique du formulaire.
 *
 * Le jour ou l'application tournera derrière plusieurs instances, ce compteur
 * devra passer en base ou dans un cache partage.
 */

export function createThrottle({ max, windowMs }) {
  const hits = new Map()

  const prune = (now) => {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key)
    }
  }

  return {
    /** Rend `true` si l'appel passe, `false` s'il depasse le quota. */
    accept(key) {
      const now = Date.now()

      // La table reste petite : on la nettoie à chaque appel plutôt que
      // d'entretenir un minuteur qui empecherait le processus de s'arreter.
      prune(now)

      const entry = hits.get(key)

      if (!entry) {
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return true
      }

      if (entry.count >= max) return false

      entry.count += 1
      return true
    },

    reset() {
      hits.clear()
    },
  }
}
