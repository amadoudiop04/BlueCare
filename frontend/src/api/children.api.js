import { apiClient, query } from '@/api/client.js'

/** Fiches enfants et ressources qui en dépendent. */

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
 * Sortie d'un enfant : la fiche quitte les listes mais l'historique reste.
 * C'est l'action normale quand un enfant n'est plus accueilli.
 */
export async function archiveChild(childId) {
  const body = await apiClient.delete(`/children/${childId}`)
  return body.data
}

/** Retour d'un enfant archive dans les effectifs. */
export async function restoreChild(childId) {
  const body = await apiClient.patch(`/children/${childId}`, { status: 'active' })
  return body.data
}

/**
 * Effacement definitif (droit a l'effacement) : la fiche, ses présences, ses
 * objectifs, ses séances, ses comptes-rendus et ses traitements disparaissent.
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


/** Tous les objectifs du périmètre : évite un appel par enfant sur la liste. */
export async function fetchGoals(params) {
  const body = await apiClient.get(`/goals${query(params)}`)
  return body.data
}

/** Chemin du rapport PDF. Le cookie de session part avec la requête. */
function progressReportPath(childId, months = 6) {
  return `/children/${childId}/progress.pdf${query({ months })}`
}

/** Nom de fichier annonce par le serveur, s'il a pu traverser le navigateur. */
function filenameFrom(response, fallback) {
  const header = response.headers.get('content-disposition') ?? ''
  const match = /filename="?([^"';]+)"?/i.exec(header)

  return match ? match[1] : fallback
}

/**
 * Telecharge le rapport de progression d'un enfant.
 *
 * Le PDF est servi par une route authentifiee : un simple lien `href`
 * n'emporterait pas le cookie de session dans tous les navigateurs, d'ou le
 * passage par un blob. Le nom du fichier est celui annonce par le serveur —
 * `progression-nom-prenom-2026-08-11.pdf` — plutôt qu'un nom réinvente ici,
 * qui divergerait a la première correction côté API.
 */
export async function downloadProgressReport(child, months = 6) {
  const response = await apiClient.raw(progressReportPath(child.id, months))
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filenameFrom(
    response,
    `progression-${child.lastName ?? 'enfant'}-${child.firstName ?? ''}.pdf`
      .toLowerCase()
      .replace(/\s+/g, '-'),
  )
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
