import { useEffect, useRef, useState } from 'react'

import { Button, ErrorNotice } from '@/components/ui/primitives.jsx'
import { cx, inputClass } from '@/lib/ui.js'

/**
 * Confirmation d'une action, avec palier de friction reglable.
 *
 * `confirmText` demande de recopier une valeur avant d'activer le bouton :
 * réserve aux actions irreversibles, ou un clic de trop efface un dossier.
 * Pour tout le reste, un simple bouton suffit — multiplier les obstacles
 * apprend surtout a cliquer sans lire.
 */
/**
 * Le contenu vit dans un composant sépare, monte seulement quand la boite
 * s'ouvre : le champ a recopier repart donc vide à chaque ouverture, sans
 * avoir a le remettre a zéro depuis un effet.
 */
function ConfirmDialog({ open, ...props }) {
  if (!open) return null
  return <Dialog {...props} />
}

function Dialog({
  title,
  description,
  children,
  confirmLabel = 'Confirmer',
  confirmText,
  tone = 'danger',
  busy,
  error,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState('')
  const panel = useRef(null)
  const field = useRef(null)

  useEffect(() => {
    // Le focus entre dans la boite : au champ a recopier s'il existe,
    // sinon au panneau lui-même pour que Echap et Tab restent utilisables.
    ;(field.current ?? panel.current)?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  const ready = !confirmText || typed.trim().toLowerCase() === confirmText.trim().toLowerCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onMouseDown={(event) => {
        // Clic sur le fond : on ferme, sauf pendant l'opération.
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        className="w-full max-w-[460px] animate-up rounded-2xl border border-line bg-white p-6 shadow-lift outline-none"
      >
        <div id="confirm-title" className="text-lg font-bold tracking-[-0.02em]">
          {title}
        </div>

        {description ? (
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-strong">{description}</p>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        {confirmText ? (
          <label className="mt-4 flex flex-col gap-2">
            <span className="text-xs font-bold text-ink">
              Pour confirmer, saisissez <span className="font-mono text-danger">{confirmText}</span>
            </span>
            <input
              ref={field}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className={inputClass}
            />
          </label>
        ) : null}

        <div className="mt-4">
          <ErrorNotice error={error} />
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy || !ready}
            className={cx(tone === 'danger' && ready && 'border-danger bg-danger-bg')}
          >
            {busy ? 'En cours…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
