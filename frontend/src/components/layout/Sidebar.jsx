import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import DeveloperCredit from '@/components/layout/DeveloperCredit.jsx'
import ButterflyMark from '@/components/ui/ButterflyMark.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { initials } from '@/lib/format.js'
import { navigationFor } from '@/lib/navigation.js'
import { roleLabel } from '@/lib/roles.js'
import { prefetchPath } from '@/lib/routes.js'
import { cx } from '@/lib/ui.js'

/**
 * Navigation principale.
 *
 * Tiroir coulissant sous 1024 px, colonne fixe au-dela. `invisible` quand il
 * est ferme, et non seulement decale : une barre poussee hors de l'écran reste
 * atteignable au clavier, et l'on tabulerait dans un menu qu'on ne voit pas.
 *
 * Chaque lien referme le tiroir en partant : sur telephone il recouvre l'écran,
 * le laisser ouvert masquerait la page qu'on vient de demander. Le voile bloque
 * le reste de l'interface, ces liens sont donc les seuls départs possibles.
 *
 * Chaque lien precharge aussi son écran des le survol ou le focus clavier.
 * Entre le moment ou le curseur s'arrête sur un lien et celui du clic, il
 * s'ecoule assez de temps pour telecharger le fichier : la page est en général
 * déjà la quand on la demande.
 */
function Sidebar({ badges = {}, open = false, onClose }) {
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
    <aside
      className={cx(
        'fixed inset-y-0 left-0 z-40 flex w-[264px] max-w-[85vw] flex-none flex-col overflow-y-auto bg-navy pb-2 transition-transform duration-200',
        'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:max-h-screen lg:max-w-none lg:translate-x-0 lg:visible lg:self-start lg:transition-none',
        open ? 'translate-x-0' : 'invisible -translate-x-full',
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-[22px] pb-5 pt-6">
        <ButterflyMark size={38} radius={11} />
        <div className="flex flex-col gap-0.5">
          <div className="text-[15px] font-bold tracking-[-0.01em] text-white">BlueCare</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-onnavy-dim">
            Centre Papillon Bleu
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className="ml-auto flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-lg text-[18px] leading-none text-onnavy hover:bg-white/10 hover:text-white lg:hidden"
        >
          ×
        </button>
      </div>

      <nav className="flex flex-col gap-[3px] px-3 pb-[18px] pt-[18px]">
        <div className="px-2.5 pb-2 pt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-onnavy-faint">
          Navigation
        </div>

        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            onMouseEnter={() => prefetchPath(item.to)}
            onFocus={() => prefetchPath(item.to)}
            onTouchStart={() => prefetchPath(item.to)}
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
          onClick={onClose}
          onMouseEnter={() => prefetchPath('/profil')}
          onFocus={() => prefetchPath('/profil')}
          className="flex items-center gap-2.5 rounded-[9px] px-2 py-3 text-[11.5px] text-onnavy-dim hover:text-white"
        >
          {/* Pastille grise, et non bleue : le bleu de la marque signale ce qui
              est actif ou cliquable, pas l'identite de celui qui regarde. */}
          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-white/[0.14] text-[10.5px] font-bold text-onnavy-pale">
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
