import { childService } from '../services/child.service.js'

/**
 * Fiches enfants. Le controller lit la requete, appelle le service, repond.
 * `req.user` est transmis au service, qui applique le perimetre du role.
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
 * Par defaut on archive (l'historique est conserve).
 * `?purge=true` efface definitivement l'enfant et ses donnees liees.
 */
export async function deleteChild(req, res) {
  if (req.query.purge === 'true') {
    res.json({ status: 'ok', data: await childService.purge(req.params.childId) })
    return
  }

  res.json({ status: 'ok', data: await childService.archive(req.params.childId) })
}
