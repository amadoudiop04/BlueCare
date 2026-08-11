import {
  ACTIVITY_CATEGORIES,
  ALERT_RULES,
  ALERT_SEVERITIES,
  ATTENDANCE_STATUSES,
  CHILD_STATUSES,
  CONTACT_RELATIONSHIPS,
  DISABILITY_TYPES,
  GENDERS,
  toOptions,
} from '../constants/domain.js'
import { env } from '../config/env.js'
import { childModel } from '../models/child.model.js'

/**
 * Référentiel expose au front : listes deroulantes et libelles.
 * Le vocabulaire metier reste ainsi défini a un seul endroit, côté serveur.
 */
export const referenceService = {
  async get() {
    return {
      disabilityTypes: toOptions(DISABILITY_TYPES),
      childStatuses: toOptions(CHILD_STATUSES),
      genders: toOptions(GENDERS),
      contactRelationships: toOptions(CONTACT_RELATIONSHIPS),
      attendanceStatuses: toOptions(ATTENDANCE_STATUSES),
      activityCategories: toOptions(ACTIVITY_CATEGORIES),
      alertRules: toOptions(ALERT_RULES),
      alertSeverities: toOptions(ALERT_SEVERITIES),
      groups: await childModel.listGroups(),
      // Le formulaire de creation de compte annonce la regle avant la saisie
      // plutot que de la faire decouvrir par un refus du serveur. La valeur
      // vient d'ici pour qu'un changement de `MIN_PASSWORD_LENGTH` n'ait pas a
      // etre reporte a la main dans le front.
      passwordPolicy: { minLength: env.auth.minPasswordLength },
      attendanceAlertRules: {
        consecutiveThreshold: env.attendance.consecutiveThreshold,
        windowDays: env.attendance.windowDays,
        windowThreshold: env.attendance.windowThreshold,
      },
    }
  },
}
