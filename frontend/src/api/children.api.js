import { apiClient, query } from '@/api/client.js'

/** Fiches enfants et ressources qui en dependent. */

export async function fetchChildren(params) {
  const body = await apiClient.get(`/children${query(params)}`)
  return { items: body.data, pagination: body.meta.pagination }
}

export async function fetchChild(childId) {
  const body = await apiClient.get(`/children/${childId}`)
  return body.data
}

export async function fetchChildGoals(childId, params) {
  const body = await apiClient.get(`/children/${childId}/goals${query(params)}`)
  return { items: body.data, summary: body.meta.summary }
}

export async function createGoal(childId, payload) {
  const body = await apiClient.post(`/children/${childId}/goals`, payload)
  return body.data
}

export async function fetchChildProgress(childId, params) {
  const body = await apiClient.get(`/children/${childId}/progress${query(params)}`)
  return { ...body.data, ...body.meta }
}

export async function fetchChildSessions(childId, params) {
  const body = await apiClient.get(`/children/${childId}/sessions${query(params)}`)
  return { items: body.data, ...body.meta }
}

export async function fetchChildGallery(childId, params) {
  const body = await apiClient.get(`/children/${childId}/gallery${query(params)}`)
  return { items: body.data, ...body.meta }
}

export async function fetchChildMedications(childId) {
  const body = await apiClient.get(`/children/${childId}/medications`)
  return body.data
}

export async function fetchChildAttendance(childId, params) {
  const body = await apiClient.get(`/children/${childId}/attendance${query(params)}`)
  return body.data
}

/** Tous les objectifs du perimetre : evite un appel par enfant sur la liste. */
export async function fetchGoals(params) {
  const body = await apiClient.get(`/goals${query(params)}`)
  return body.data
}

/** URL de telechargement du rapport PDF (le jeton part dans l'en-tete). */
export function progressReportPath(childId, months = 6) {
  return `/children/${childId}/progress.pdf${query({ months })}`
}
