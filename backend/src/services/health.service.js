import { env } from '../config/env.js'

/**
 * Les services portent la logique metier et les acces aux donnees.
 * Ils ne connaissent ni `req` ni `res`, ce qui les rend testables seuls.
 */
export const healthService = {
  async check() {
    return {
      service: 'bluecare-api',
      environment: env.nodeEnv,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  },
}
