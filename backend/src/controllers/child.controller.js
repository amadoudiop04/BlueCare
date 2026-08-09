import { childService } from '../services/child.service.js'

/**
 * Fiches enfants. Le controller lit la requête, appelle le service, répond.
 * `req.user` est transmis au service, qui applique le périmètre du rôle.
 */

export async function listChildren(req, res) {
  const { items, pagination } = await childService.list(req.query, req.user)
  res.json({ status: 'ok', data: items, meta: { pagination } })
}

export async function getChild(req, res) {
  res.json({ status: 'ok', data: await childService.getById(req.params.childId, req.user) })
}

export async function createChild(req, res) {
  res.status(201).json({ status: 'ok', data: await childService.create(req.body) })
}

export async function updateChild(req, res) {
  res.json({
    status: 'ok',
    data: await childService.update(req.params.childId, req.body, req.user),
  })
}

/**
 * Par défaut on archive (l'historique est conserve).
 * `?purge=true` efface définitivement l'enfant et ses données liées.
 */
export async function deleteChild(req, res) {
  if (req.query.purge === 'true') {
    res.json({ status: 'ok', data: await childService.purge(req.params.childId) })
    return
  }

  res.json({ status: 'ok', data: await childService.archive(req.params.childId) })
}
