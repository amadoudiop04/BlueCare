import { reportService } from '../services/report.service.js'
import { sessionService } from '../services/session.service.js'

/** Seances et comptes-rendus. */

export async function listSessions(req, res) {
  const { items, pagination } = await sessionService.list(req.query, req.user)
  res.json({ status: 'ok', data: items, meta: { pagination } })
}

export async function getSession(req, res) {
  res.json({ status: 'ok', data: await sessionService.getById(req.params.sessionId, req.user) })
}

export async function createSession(req, res) {
  const session = await sessionService.create(req.params.childId, req.body, req.user)
  res.status(201).json({ status: 'ok', data: session })
}

export async function updateSession(req, res) {
  res.json({
    status: 'ok',
    data: await sessionService.update(req.params.sessionId, req.body, req.user),
  })
}

export async function cancelSession(req, res) {
  res.json({
    status: 'ok',
    data: await sessionService.cancel(req.params.sessionId, req.body, req.user),
  })
}

export async function deleteSession(req, res) {
  res.json({ status: 'ok', data: await sessionService.remove(req.params.sessionId, req.user) })
}

export async function getChildSessions(req, res) {
  const history = await sessionService.getChildHistory(req.params.childId, req.query, req.user)
  const { items, ...meta } = history

  res.json({ status: 'ok', data: items, meta })
}

// --- Comptes-rendus ---------------------------------------------------------

export async function createReport(req, res) {
  const { report, goals } = await reportService.createForSession(
    req.params.sessionId,
    req.body,
    req.user,
  )
  res.status(201).json({ status: 'ok', data: report, meta: { updatedGoals: goals } })
}

export async function getReport(req, res) {
  res.json({ status: 'ok', data: await reportService.getById(req.params.reportId, req.user) })
}

export async function updateReport(req, res) {
  const { report, goals } = await reportService.update(req.params.reportId, req.body, req.user)
  res.json({ status: 'ok', data: report, meta: { updatedGoals: goals } })
}

export async function deleteReport(req, res) {
  res.json({ status: 'ok', data: await reportService.remove(req.params.reportId, req.user) })
}

export async function listReports(req, res) {
  const { items, pagination } = await reportService.list(req.query, req.user)
  res.json({ status: 'ok', data: items, meta: { pagination } })
}

export async function listPendingReports(req, res) {
  const { items, summary } = await reportService.listPending(req.query, req.user)
  res.json({ status: 'ok', data: items, meta: { summary } })
}
