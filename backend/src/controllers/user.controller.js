import { userService } from '../services/user.service.js'

/** Gestion des comptes, reservee au directeur. */

export async function listUsers(req, res) {
  const { items, pagination } = await userService.list(req.query)
  res.json({ status: 'ok', data: items, meta: { pagination } })
}

export async function getUser(req, res) {
  res.json({ status: 'ok', data: await userService.getById(req.params.userId) })
}

export async function createUser(req, res) {
  res.status(201).json({ status: 'ok', data: await userService.create(req.body) })
}

export async function updateUser(req, res) {
  res.json({ status: 'ok', data: await userService.update(req.params.userId, req.body) })
}

export async function resetUserPassword(req, res) {
  res.json({ status: 'ok', data: await userService.resetPassword(req.params.userId, req.body) })
}

export async function disableUser(req, res) {
  res.json({ status: 'ok', data: await userService.disable(req.params.userId, req.user) })
}
