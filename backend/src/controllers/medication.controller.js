import { medicationService } from '../services/medication.service.js'

/** Traitements, rappels et traces d'administration. */

export async function listChildMedications(req, res) {
  const data = await medicationService.listForChild(req.params.childId, req.query, req.user)
  res.json({ status: 'ok', data })
}

export async function createMedication(req, res) {
  const data = await medicationService.create(req.params.childId, req.body, req.user)
  res.status(201).json({ status: 'ok', data })
}

export async function updateMedication(req, res) {
  const data = await medicationService.update(req.params.medicationId, req.body, req.user)
  res.json({ status: 'ok', data })
}

export async function deleteMedication(req, res) {
  const data = await medicationService.remove(req.params.medicationId, req.user)
  res.json({ status: 'ok', data })
}

export async function listDoses(req, res) {
  const { doses, date, summary } = await medicationService.getDoses(req.query, req.user)
  res.json({ status: 'ok', data: doses, meta: { date, summary } })
}

export async function recordAdministration(req, res) {
  const data = await medicationService.recordAdministration(
    req.params.medicationId,
    req.body,
    req.user,
  )
  res.status(201).json({ status: 'ok', data })
}

export async function listChildAdministrations(req, res) {
  const data = await medicationService.listAdministrations(
    req.params.childId,
    req.query,
    req.user,
  )
  res.json({ status: 'ok', data })
}
