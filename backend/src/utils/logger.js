/**
 * Logger minimal centralise. A remplacer par pino/winston si besoin,
 * sans avoir a modifier les appelants.
 */
export const logger = {
  info: (...args) => console.log('[info]', ...args),
  warn: (...args) => console.warn('[warn]', ...args),
  error: (...args) => console.error('[error]', ...args),
}
