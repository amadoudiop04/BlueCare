/**
 * Enveloppe un controller async pour que ses rejets partent vers `next`
 * au lieu de finir en promesse non geree.
 *
 *   router.get('/', asyncHandler(controller.list))
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)
