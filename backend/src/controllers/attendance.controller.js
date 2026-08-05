import { attendanceService } from '../services/attendance.service.js'

/** Presences quotidiennes et alertes d'absences. */

export async function getDailySheet(req, res) {
  res.json({ status: 'ok', data: await attendanceService.getDailySheet(req.query, req.user) })
}

export async function recordAttendance(req, res) {
  const { record, alerts } = await attendanceService.record(req.body, req.user)
  res.status(201).json({ status: 'ok', data: record, meta: { alerts } })
}

export async function recordAttendanceBulk(req, res) {
  const { date, records, alerts } = await attendanceService.recordMany(req.body, req.user)
  res.status(201).json({ status: 'ok', data: records, meta: { date, alerts } })
}

export async function listAttendanceAlerts(req, res) {
  const { items, period, rules } = await attendanceService.listAlerts(req.query, req.user)
  res.json({ status: 'ok', data: items, meta: { period, rules } })
}

export async function getChildAttendance(req, res) {
  res.json({
    status: 'ok',
    data: await attendanceService.getChildHistory(req.params.childId, req.query, req.user),
  })
}

export async function getChildAttendanceAlerts(req, res) {
  res.json({
    status: 'ok',
    data: await attendanceService.getChildAlerts(req.params.childId, req.user),
  })
}

export async function deleteAttendance(req, res) {
  const { childId, date } = req.params
  res.json({ status: 'ok', data: await attendanceService.remove(childId, date, req.user) })
}
