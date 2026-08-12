import { useEffect, useState } from 'react'

import { isApple } from '@/lib/palette.js'

/**
 * Annonce du raccourci de recherche.
 *
 * `Ctrl K` ouvre la palette (`CommandPalette.jsx`) depuis n'importe quel écran,
 * mais rien dans l'interface ne le dit : un raccourci qui n'est ecrit nulle
 * part n'existe que pour celui qui l'a code. Ce bandeau le presente une fois,
 * puis disparait definitivement — soit qu'on le ferme, soit qu'on se serve du
 * raccourci, ce qui prouve mieux encore qu'il est connu.
 *
 * Il arrive après un temps mort volontaire : surgir pendant que l'écran se
 * remplit, c'est se faire lire par personne. Le temps que la premiere page
 * s'affiche et que le regard se pose, l'astuce est la.
 */
const APPEAR_DELAY_MS = 1800

function ShortcutHint({ onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      /* `status` et non `alert` : c'est une information de confort, elle ne
         doit pas interrompre la lecture en cours d'un lecteur d'écran. */
      role="status"
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] animate-up items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-lift sm:bottom-6 sm:right-6 sm:max-w-[380px]"
    >
      <span
        className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-brand-50 font-mono text-[11px] font-bold text-brand-dark"
        aria-hidden="true"
      >
        K
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold tracking-[-0.01em] text-ink">
          Astuce : la recherche au clavier
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-strong">
          Appuyez sur{' '}
          <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">
            {isApple ? '⌘' : 'Ctrl'}
          </kbd>{' '}
          <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">
            K
          </kbd>{' '}
          depuis n’importe quel écran pour rechercher un enfant ou ouvrir une page.
        </p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer l’astuce"
        className="-mr-1 -mt-1 flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-lg text-[16px] leading-none text-muted hover:bg-canvas hover:text-ink"
      >
        ×
      </button>
    </div>
  )
}

export default ShortcutHint
