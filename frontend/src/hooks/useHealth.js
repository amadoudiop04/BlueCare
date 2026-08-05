import { useEffect, useState } from 'react'
import { fetchHealth } from '@/api/health.api.js'

/** Etat de connexion au backend : 'loading' | 'ok' | 'error'. */
export function useHealth() {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()

    fetchHealth({ signal: controller.signal })
      .then(() => setStatus('ok'))
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error')
      })

    return () => controller.abort()
  }, [])

  return status
}
