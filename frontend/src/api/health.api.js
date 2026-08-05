import { apiClient } from '@/api/client.js'

/** Verifie que le backend repond. */
export function fetchHealth(options) {
  return apiClient.get('/health', options)
}
