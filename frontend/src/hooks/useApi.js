import { useCallback, useEffect, useState } from 'react'

import { dedupe, readCache, writeCache } from '@/lib/cache.js'

/**
 * Chargement d'une ressource distante.
 *
 *   const { data, error, loading, reload } = useApi(() => fetchChild(id), [id])
 *
 * `loading` est deduit, jamais pose : l'état garde la clé de la requête qui
 * l'a produit, et tant qu'elle ne correspond pas a la clé courante on est en
 * chargement. Cela évite un `setState` synchrone dans l'effet — qui
 * declencherait un rendu en cascade à chaque changement de dépendance.
 *
 * La réponse d'une requête annulée est ignoree : pas de mise à jour sur un
 * composant demonte, et pas de réponse tardive qui ecraserait une plus récente.
 *
 * ## Option `cache`
 *
 *   useApi(() => loadChildren(status), [status], { cache: 'children' })
 *
 * Avec un espace de noms, la réponse est mémorisée (voir `lib/cache.js`).
 * Revenir sur l'écran réaffiche alors immédiatement ce qu'on y avait vu,
 * pendant qu'une requête va chercher la version a jour : `loading` reste faux,
 * `refreshing` passe a vrai. Sans cette option, rien n'est mémorisé — c'est le
 * cas des écrans dont la donnée ne vaut que sur l'instant.
 *
 * `reload()` ignore volontairement le cache : on le déclenche pour obtenir la
 * vérité du serveur, pas pour revoir ce qu'on avait déjà.
 */
export function useApi(loader, deps = [], { cache: namespace } = {}) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: null, data: null, error: null })

  const depsKey = JSON.stringify(deps)
  const cacheKey = namespace ? `${namespace}:${depsKey}` : null
  const key = `${depsKey}#${attempt}`

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false

    // La clé porte `attempt` : deux écrans qui demandent la même chose au même
    // instant partagent un appel, mais un rechargement explicite en refait un.
    dedupe(cacheKey && `${cacheKey}#${attempt}`, () => Promise.resolve().then(loader))
      .then((data) => {
        writeCache(cacheKey, data)
        if (!cancelled) setState({ key, data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ key, data: null, error })
      })

    return () => {
      cancelled = true
    }
    // `loader` est recree à chaque rendu : c'est `key` qui decrit la requête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const fresh = state.key === key
  // Rien de mémorisé pendant un `reload()` : voir plus haut.
  const cached = fresh || attempt > 0 ? null : readCache(cacheKey)

  return {
    data: fresh ? state.data : (cached?.data ?? null),
    error: fresh ? state.error : null,
    /** Rien a afficher pour l'instant : c'est le moment du squelette. */
    loading: !fresh && !cached,
    /** Un contenu est affiche, une requête le rafraichit en arrière-plan. */
    refreshing: !fresh && Boolean(cached),
    reload,
  }
}
