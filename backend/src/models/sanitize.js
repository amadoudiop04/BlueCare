/**
 * Champs d'un compte qui ne doivent jamais sortir de l API.
 *
 * Centralise ici et applique par les deux pilotes : ajouter un secret sur la
 * table `users` sans penser a la réponse HTTP est exactement le genre d'oubli
 * qui ne se voit pas en relecture.
 */
const SECRET_FIELDS = [
  'passwordHash',
  'totpSecret',
  'recoveryCodes',
  'resetTokenHash',
  'resetExpiresAt',
]

export function sanitizeUser(user) {
  if (!user) return undefined

  const safe = { ...user }
  for (const field of SECRET_FIELDS) delete safe[field]

  // L'état de la double authentification est public pour son propriétaire :
  // c'est le secret qui ne l'est pas.
  safe.mfaEnabled = Boolean(user.totpEnabled)
  safe.recoveryCodesLeft = (user.recoveryCodes ?? []).length

  return safe
}

