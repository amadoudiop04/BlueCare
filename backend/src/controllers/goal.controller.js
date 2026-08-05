import { goalService } from '../services/goal.service.js'
import { progressService } from '../services/progress.service.js'

/** Objectifs pedagogiques et courbes d'evolution. */

export async function listChildGoals(req, res) {
  const { items, summary } = await goalService.listForChild(
    req.params.childId,
    req.query,
    req.user,
  )
  res.json({ status: 'ok', data: items, meta: { summary } })
}

export async function listGoals(req, res) {
  res.json({ status: 'ok', data: await goalService.list(req.query, req.user) })
}

export async function getGoal(req, res) {
  res.json({ status: 'ok', data: await goalService.getById(req.params.goalId, req.user) })
}

export async function createGoal(req, res) {
  const goal = await goalService.create(req.params.childId, req.body, req.user)
  res.status(201).json({ status: 'ok', data: goal })
}

export async function updateGoal(req, res) {
  res.json({
    status: 'ok',
    data: await goalService.update(req.params.goalId, req.body, req.user),
  })
}

export async function deleteGoal(req, res) {
  res.json({ status: 'ok', data: await goalService.remove(req.params.goalId, req.user) })
}

export async function getChildProgress(req, res) {
  const progress = await progressService.getChildProgress(req.params.childId, req.query, req.user)
  const { goals, mood, ...meta } = progress

  res.json({ status: 'ok', data: { goals, mood }, meta })
}

export async function getGoalProgress(req, res) {
  const serie = await progressService.getGoalProgress(req.params.goalId, req.query, req.user)
  res.json({ status: 'ok', data: serie })
}
