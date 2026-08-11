import { useEffect, useRef, useState } from 'react'

import { cx, inputClass } from '@/lib/ui.js'

/**
 * Champ mot de passe avec bouton d'affichage.
 *
 * Deux détails tiennent au contexte : l'application tourne sur des postes
 * partages (salle Baobab, tablettes du centre), donc le mot de passe revient
 * masque tout seul au bout de quelques secondes, et le bouton porte
 * `type="button"` pour ne jamais soumettre le formulaire par erreur.
 */

/** Durée avant re-masquage automatique. Assez pour relire une saisie. */
const AUTO_HIDE_MS = 10000

function EyeIcon({ crossed }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed ? <path d="m4 20 16-16" /> : null}
    </svg>
  )
}

function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false)
  const timer = useRef(null)

  // Le mot de passe ne reste pas lisible indefiniment sur un écran partage.
  useEffect(() => {
    if (!visible) return undefined

    timer.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS)
    return () => clearTimeout(timer.current)
  }, [visible])

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cx(inputClass, 'pr-11', visible && 'font-mono tracking-tight', className)}
      />

      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        title={visible ? 'Masquer' : 'Afficher'}
        className={cx(
          'absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2',
          'text-muted hover:text-brand focus-visible:text-brand',
          visible && 'text-brand',
        )}
      >
        <EyeIcon crossed={visible} />
      </button>
    </div>
  )
}

export default PasswordInput
