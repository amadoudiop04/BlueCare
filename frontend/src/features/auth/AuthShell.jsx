import { Link } from 'react-router-dom'

import DeveloperCredit from '@/components/layout/DeveloperCredit.jsx'
import ButterflyMark from '@/components/ui/ButterflyMark.jsx'

/**
 * Cadre commun aux ecrans accessibles sans session.
 *
 * L ecran de connexion garde sa mise en page en deux volets : c est la vitrine
 * de l application. Les ecrans de reinitialisation, eux, sont des passages —
 * on y arrive depuis un courriel, on en repart connecte. Une colonne centree
 * suffit, et evite de charger l animation three.js pour rien.
 */
function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[400px] animate-up">
        <Link to="/connexion" className="mb-8 flex items-center gap-3">
          <ButterflyMark size={40} radius={12} />
          <div className="flex flex-col gap-0.5">
            <div className="text-base font-bold tracking-[-0.01em]">BlueCare</div>
            <div className="text-[11px] font-medium text-muted">Centre Papillon Bleu</div>
          </div>
        </Link>

        <div className="mb-[7px] text-2xl font-bold tracking-[-0.02em]">{title}</div>
        <div className="mb-7 text-[13.5px] leading-[1.6] text-muted text-pretty">{subtitle}</div>

        {children}

        {footer ? <div className="mt-6 text-center text-[12.5px]">{footer}</div> : null}
      </div>

      <DeveloperCredit className="mt-12" />
    </div>
  )
}

/** Bandeau d erreur, identique a celui de l ecran de connexion. */
export function AuthError({ children }) {
  if (!children) return null

  return (
    <div
      role="alert"
      className="rounded-[10px] border border-danger/25 bg-danger-bg px-3.5 py-3 text-[12.5px] font-semibold text-danger"
    >
      {children}
    </div>
  )
}

export default AuthShell
