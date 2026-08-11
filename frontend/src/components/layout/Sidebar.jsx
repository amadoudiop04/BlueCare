import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import DeveloperCredit from '@/components/layout/DeveloperCredit.jsx'
import ButterflyMark from '@/components/ui/ButterflyMark.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { initials } from '@/lib/format.js'
import { navigationFor } from '@/lib/navigation.js'
import { roleLabel } from '@/lib/roles.js'
import { cx } from '@/lib/ui.js'

function Sidebar({ badges = {} }) {
  const { user, logout } = useAuth()
  const items = navigationFor(user.role)
  const [leaving, setLeaving] = useState(false)

  const onLogout = async () => {
    setLeaving(true)
    // `logout` avale ses erreurs : sur un poste partagé, se déconnecter doit
    // aboutir même si le réseau est tombe. Pas de `finally` pour reactiver le
    // bouton, l'écran de connexion remplace la barre dans la foulee.
    await logout()
  }

  return (
    <aside className="sticky top-0 flex h-screen max-h-screen w-[264px] flex-none flex-col self-start overflow-y-auto bg-navy pb-2">
      <div className="flex items-center gap-3 border-b border-white/10 px-[22px] pb-5 pt-6">
        <ButterflyMark size={38} radius={11} />
        <div className="flex flex-col gap-0.5">
          <div className="text-[15px] font-bold tracking-[-0.01em] text-white">BlueCare</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-onnavy-dim">
            Centre Papillon Bleu
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-[3px] px-3 py-[18px]">
        <div className="px-2.5 pb-2 pt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-onnavy-faint">
          Navigation
        </div>

        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx(
                'flex w-full items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-left text-[13.5px]',
                isActive
                  ? 'bg-brand font-semibold text-white'
                  : 'font-medium text-onnavy hover:bg-white/[0.07] hover:text-white',
              )
            }
          >
            <span className="inline-block w-4 font-mono text-[11px] opacity-70">{item.tag}</span>
            <span className="flex-1">{item.label}</span>
            {badges[item.to] ? (
              <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                {badges[item.to]}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-3 pb-[18px] pt-3.5">
        <NavLink
          to="/profil"
          className="flex items-center gap-2.5 rounded-[9px] px-2 py-3 text-[11.5px] text-onnavy-dim hover:text-white"
        >
          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-brand text-[10.5px] font-bold text-white">
            {initials(user.firstName, user.lastName)}
          </span>
          <span className="min-w-0 truncate">
            {user.firstName} {user.lastName} ·{' '}
            <span className="font-mono">{roleLabel(user.role)}</span>
          </span>
        </NavLink>

        {/*
         * La déconnexion est à portée de main depuis n'importe quel écran.
         * Sur les postes partagés du centre, l'enfouir dans la page Profil
         * revient a ce que personne ne se déconnecte.
         */}
        <button
          type="button"
          onClick={onLogout}
          disabled={leaving}
          className={cx(
            'mt-1 flex w-full items-center gap-[11px] rounded-[9px] px-3 py-2.5 text-left text-[13.5px] font-medium',
            'text-onnavy hover:bg-danger/25 hover:text-white disabled:opacity-60',
          )}
        >
          <span className="inline-block w-4 font-mono text-[11px] opacity-70">{'<-'}</span>
          <span className="flex-1">{leaving ? 'Déconnexion…' : 'Déconnexion'}</span>
        </button>

        <DeveloperCredit tone="light" className="mt-3 border-t border-white/[0.08] px-2 pt-3.5" />
      </div>
    </aside>
  )
}

export default Sidebar
