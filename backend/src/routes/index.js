import { Router } from 'express'

import healthRoutes from './health.routes.js'

const router = Router()

// Chaque domaine metier est monte ici sous son prefixe.
router.use('/health', healthRoutes)

export default router
