import { cx } from '@/lib/ui.js'

/**
 * Mention de l auteur, en pied d'application.
 *
 * Deux tonalites : `light` pour les fonds bleu nuit (barre laterale, ecran de
 * connexion), `dark` pour les fonds clairs. Le texte reste discret — c est une
 * signature, pas un element d'interface.
 */
function DeveloperCredit({ tone = 'dark', className }) {
  return (
    <p
      className={cx(
        'text-[10.5px] leading-relaxed',
        tone === 'light' ? 'text-onnavy-faint' : 'text-muted-light',
        className,
      )}
    >
      Developpe par <span className="font-semibold">Amadou Diop</span>
    </p>
  )
}

export default DeveloperCredit
