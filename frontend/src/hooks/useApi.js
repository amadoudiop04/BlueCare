import { useCallback, useEffect, useState } from 'react'

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
 */
export function useApi(loader, deps = []) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: null, data: null, error: null })

  const key = `${JSON.stringify(deps)}#${attempt}`
  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false

    Promise.resolve()
      .then(loader)
      .then((data) => {
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

  const loading = state.key !== key

  return {
    data: loading ? null : state.data,
    error: loading ? null : state.error,
    loading,
    reload,
  }
}
