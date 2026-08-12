import { apiClient, query } from '@/api/client.js'
import { dedupe, readCache, writeCache } from '@/lib/cache.js'

/** Séances, comptes-rendus, présences, notifications et tableau de bord. */

export async function createSession(childId, payload) {
  const body = await apiClient.post(`/children/${childId}/sessions`, payload)
  return body.data
}


export async function submitReport(sessionId, payload) {
  const body = await apiClient.post(`/sessions/${sessionId}/report`, payload)
  return { report: body.data, updatedGoals: body.meta.updatedGoals }
}

export async function fetchPendingReports() {
  const body = await apiClient.get('/reports/pending')
  return { items: body.data, summary: body.meta.summary }
}

export async function fetchAttendanceSheet(params) {
  const body = await apiClient.get(`/attendance${query(params)}`)
  return body.data
}

export async function recordAttendance(payload) {
  const body = await apiClient.post('/attendance', payload)
  return { record: body.data, alerts: body.meta.alerts }
}

/** Annule une saisie de présence (mauvais enfant, mauvais jour). */
export async function deleteAttendance(childId, date) {
  const body = await apiClient.delete(`/attendance/${childId}/${date}`)
  return body.data
}

export async function fetchAttendanceAlerts(params) {
  const body = await apiClient.get(`/attendance/alerts${query(params)}`)
  return { items: body.data, ...body.meta }
}

export async function fetchNotifications(params) {
  const body = await apiClient.get(`/notifications${query(params)}`)
  return { items: body.data, summary: body.meta.summary }
}


export async function fetchDashboard(params) {
  const body = await apiClient.get(`/dashboard${query(params)}`)
  return body.data
}

/**
 * Listes de valeurs du référentiel : types de handicap, statuts, groupes,
 * humeurs, seuils d'alerte.
 *
 * Presque tous les écrans en ont besoin, et la réponse ne bouge pas d'une
 * minute a l'autre. Elle est donc mémorisée : la liste des enfants, la fiche
 * individuelle et les deux formulaires la partagent au lieu de la redemander
 * chacun de leur côte. Comme le reste du cache, elle expire d'elle-même et
 * disparait a la déconnexion — les groupes existants font partie du périmètre,
 * ils n'ont rien a faire dans la session du suivant.
 */
const REFERENCE_KEY = 'reference:[]'

export async function fetchReference() {
  const cached = readCache(REFERENCE_KEY)
  if (cached) return cached.data

  // `dedupe` couvre le cas de deux écrans montes ensemble : un seul appel part.
  return dedupe(REFERENCE_KEY, async () => {
    const body = await apiClient.get('/reference')
    writeCache(REFERENCE_KEY, body.data)
    return body.data
  })
}

export async function fetchMedicationDoses(params) {
  const body = await apiClient.get(`/medications/doses${query(params)}`)
  return { items: body.data, ...body.meta }
}

export async function recordAdministration(medicationId, payload) {
  const body = await apiClient.post(`/medications/${medicationId}/administrations`, payload)
  return body.data
}

/** Progression servie par un lien famille, sans authentification. */
export async function fetchSharedProgress(token) {
  const body = await apiClient.get(`/share/${token}/progress`)
  return { ...body.data, ...body.meta }
}
