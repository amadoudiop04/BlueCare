import { useCallback, useEffect, useState } from 'react'

/**
 * Chargement d'une ressource distante.
 *
 *   const { data, error, loading, reload } = useApi(() => fetchChild(id), [id])
 *
 * `loading` est deduit, jamais pose : l'etat garde la cle de la requete qui
 * l'a produit, et tant qu'elle ne correspond pas a la cle courante on est en
 * chargement. Cela evite un `setState` synchrone dans l'effet — qui
 * declencherait un rendu en cascade a chaque changement de dependance.
 *
 * La reponse d'une requete annulee est ignoree : pas de mise a jour sur un
 * composant demonte, et pas de reponse tardive qui ecraserait une plus recente.
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
    // `loader` est recree a chaque rendu : c'est `key` qui decrit la requete.
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
