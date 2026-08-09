import { Router } from 'express'

import {
  changePassword,
  checkResetToken,
  confirmMfaEnrollment,
  deleteAccount,
  disableMfa,
  forgotPassword,
  getMfaStatus,
  listSessions,
  login,
  logout,
  me,
  previewAccountDeletion,
  resetPassword,
  revokeOtherSessions,
  revokeSession,
  startMfaEnrollment,
  verifyMfa,
} from '../controllers/auth.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/*
 * Routes ouvertes sans session.
 * `/mfa/verify` n'en fait pas exception : elle exige le jeton de défi remis
 * par `/login`, qui n'ouvre rien d'autre et expire en quelques minutes.
 */
router.post('/login', asyncHandler(login))
router.post('/mfa/verify', asyncHandler(verifyMfa))

/*
 * Mot de passe oublié. Ces trois routes sont forcement ouvertes : une personne
 * qui a perdu son mot de passe ne peut pas s'authentifier pour le redemander.
 * C'est le jeton du lien, envoyé a l'adresse du compte, qui fait autorite —
 * et le second facteur reste exige quand il est actif.
 */
router.post('/password/forgot', asyncHandler(forgotPassword))
router.get('/password/reset/:token', asyncHandler(checkResetToken))
router.post('/password/reset/:token', asyncHandler(resetPassword))

// La déconnexion supprime la session en base ET le cookie, même si la session
// a déjà expire : elle ne doit jamais échouer sur un poste partagé.
router.post('/logout', asyncHandler(logout))

router.get('/me', authenticate, asyncHandler(me))
router.post('/password', authenticate, asyncHandler(changePassword))

// Suppression de son propre compte. `GET` decrit d'abord ce qui sera efface
// et ce qui sera conserve, pour que la confirmation soit eclairee.
router.get('/account/deletion', authenticate, asyncHandler(previewAccountDeletion))
router.delete('/account', authenticate, asyncHandler(deleteAccount))

// Appareils connectes.
router.get('/sessions', authenticate, asyncHandler(listSessions))
router.delete('/sessions', authenticate, asyncHandler(revokeOtherSessions))
router.delete('/sessions/:sessionId', authenticate, asyncHandler(revokeSession))

// Enrôlement du second facteur, sur son propre compte uniquement.
router.get('/mfa', authenticate, asyncHandler(getMfaStatus))
router.post('/mfa/setup', authenticate, asyncHandler(startMfaEnrollment))
router.post('/mfa/enable', authenticate, asyncHandler(confirmMfaEnrollment))
router.post('/mfa/disable', authenticate, asyncHandler(disableMfa))

export default router
