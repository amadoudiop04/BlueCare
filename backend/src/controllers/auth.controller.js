import { authService } from '../services/auth.service.js'

/** Connexion, session et liens de suivi famille. */

export async function login(req, res) {
  const { user, ...tokens } = await authService.login(req.body)
  res.json({ status: 'ok', data: { user }, meta: tokens })
}

export async function refresh(req, res) {
  const { user, ...tokens } = await authService.refresh(req.body)
  res.json({ status: 'ok', data: { user }, meta: tokens })
}

export async function me(req, res) {
  res.json({ status: 'ok', data: await authService.me(req.user) })
}

export async function changePassword(req, res) {
  res.json({ status: 'ok', data: await authService.changePassword(req.user, req.body) })
}

export async function createFamilyLink(req, res) {
  const link = await authService.createFamilyLink(req.user, req.params.childId, req.body)
  res.status(201).json({ status: 'ok', data: link })
}
