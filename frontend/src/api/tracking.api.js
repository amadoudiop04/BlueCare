import { apiClient, query } from '@/api/client.js'

/** Seances, comptes-rendus, presences, notifications et tableau de bord. */

export async function createSession(childId, payload) {
  const body = await apiClient.post(`/children/${childId}/sessions`, payload)
  return body.data
}

export async function fetchSession(sessionId) {
  const body = await apiClient.get(`/sessions/${sessionId}`)
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

export async function fetchAttendanceAlerts(params) {
  const body = await apiClient.get(`/attendance/alerts${query(params)}`)
  return { items: body.data, ...body.meta }
}

export async function fetchNotifications(params) {
  const body = await apiClient.get(`/notifications${query(params)}`)
  return { items: body.data, summary: body.meta.summary }
}

export async function markNotificationRead(notificationId) {
  const body = await apiClient.post(`/notifications/${encodeURIComponent(notificationId)}/read`)
  return body.data
}

export async function fetchDashboard(params) {
  const body = await apiClient.get(`/dashboard${query(params)}`)
  return body.data
}

export async function fetchReference() {
  const body = await apiClient.get('/reference')
  return body.data
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
