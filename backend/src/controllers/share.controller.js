import { authService } from '../services/auth.service.js'
import { progressService } from '../services/progress.service.js'
import { goalService } from '../services/goal.service.js'

/**
 * Lien de suivi famille : lecture seule, un seul enfant, sans mot de passe.
 * Le jeton porte lui-même le périmètre (voir `authenticateFamilyLink`).
 */

export async function createFamilyLink(req, res) {
  const link = await authService.createFamilyLink(req.user, req.params.childId, req.body)
  res.status(201).json({ status: 'ok', data: link })
}

export async function getSharedProgress(req, res) {
  const { childId } = req.shareLink
  const progress = await progressService.getChildProgress(childId, req.query, req.user)
  const { goals, mood, ...meta } = progress

  res.json({ status: 'ok', data: { goals, mood }, meta })
}

export async function getSharedGoals(req, res) {
  const { items, summary } = await goalService.listForChild(
    req.shareLink.childId,
    req.query,
    req.user,
  )
  res.json({ status: 'ok', data: items, meta: { summary } })
}
