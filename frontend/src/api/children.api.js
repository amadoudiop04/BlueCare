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

export async function createChild(payload) {
  const body = await apiClient.post('/children', payload)
  return body.data
}


/**
 * Sortie d un enfant : la fiche quitte les listes mais l historique reste.
 * C est l'action normale quand un enfant n'est plus accueilli.
 */
export async function archiveChild(childId) {
  const body = await apiClient.delete(`/children/${childId}`)
  return body.data
}

/** Retour d un enfant archive dans les effectifs. */
export async function restoreChild(childId) {
  const body = await apiClient.patch(`/children/${childId}`, { status: 'active' })
  return body.data
}

/**
 * Effacement definitif (droit a l effacement) : la fiche, ses presences, ses
 * objectifs, ses seances, ses comptes-rendus et ses traitements disparaissent.
 * Irreversible.
 */
export async function purgeChild(childId) {
  const body = await apiClient.delete(`/children/${childId}?purge=true`)
  return body.data
}

export async function fetchChildGoals(childId, params) {
  const body = await apiClient.get(`/children/${childId}/goals${query(params)}`)
  return { items: body.data, summary: body.meta.summary }
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


/** Tous les objectifs du perimetre : evite un appel par enfant sur la liste. */
export async function fetchGoals(params) {
  const body = await apiClient.get(`/goals${query(params)}`)
  return body.data
}

/** Chemin du rapport PDF. Le cookie de session part avec la requete. */
export function progressReportPath(childId, months = 6) {
  return `/children/${childId}/progress.pdf${query({ months })}`
}
