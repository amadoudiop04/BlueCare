import { referenceService } from '../services/reference.service.js'

export async function getReference(req, res) {
  res.json({ status: 'ok', data: await referenceService.get() })
}
