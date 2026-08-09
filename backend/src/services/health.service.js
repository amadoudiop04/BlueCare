import { env } from '../config/env.js'
import { driverName } from '../models/driver.js'

/**
 * Les services portent la logique metier et les acces aux donnees.
 * Ils ne connaissent ni `req` ni `res`, ce qui les rend testables seuls.
 */
export const healthService = {
  async check() {
    return {
      service: 'bluecare-api',
      environment: env.nodeEnv,
      /*
       * Le pilote de stockage actif. C'est la verification qui compte apres une
       * mise en ligne : `memory` sur un serveur de production signifie que les
       * clefs Supabase ne sont pas lues et que tout sera perdu au prochain
       * redemarrage. Le savoir depuis l'exterieur evite de le decouvrir trop tard.
       */
      storage: driverName,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  },
}
