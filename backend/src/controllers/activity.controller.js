import { activityService } from '../services/activity.service.js'

/** Activites et galerie anonymisee. */

export async function listActivities(req, res) {
  const { items, pagination } = await activityService.list(req.query, req.user)
  res.json({ status: 'ok', data: items, meta: { pagination } })
}

export async function getActivity(req, res) {
  res.json({ status: 'ok', data: await activityService.getById(req.params.activityId, req.user) })
}

export async function createActivity(req, res) {
  res.status(201).json({ status: 'ok', data: await activityService.create(req.body, req.user) })
}

export async function updateActivity(req, res) {
  res.json({
    status: 'ok',
    data: await activityService.update(req.params.activityId, req.body, req.user),
  })
}

export async function deleteActivity(req, res) {
  res.json({ status: 'ok', data: await activityService.remove(req.params.activityId, req.user) })
}

export async function getChildGallery(req, res) {
  const { child, items, pagination } = await activityService.getChildGallery(
    req.params.childId,
    req.query,
    req.user,
  )
  res.json({ status: 'ok', data: items, meta: { child, pagination } })
}
