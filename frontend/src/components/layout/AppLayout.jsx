import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

import Sidebar from '@/components/layout/Sidebar.jsx'
import ButterflyMark from '@/components/ui/ButterflyMark.jsx'

/**
 * Structure de l'application connectee : barre laterale, contenu a droite.
 * Chaque page pose son propre en-tête via <PageHeader>, parce que le titre,
 * le fil d'ariane et l'action principale dépendent de l'écran.
 *
 * Sous 1024 px, la barre laterale coute 264 px sur les 375 px d'un telephone :
 * elle devient un tiroir, et une barre superieure porte le bouton qui l'ouvre.
 * L'état vit ici plutôt que dans la barre elle-même, parce que le voile et le
 * bouton d'ouverture sont ses voisins, pas ses enfants.
 */
function AppLayout({ badges }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar badges={badges} open={menuOpen} onClose={() => setMenuOpen(false)} />

      {menuOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-navy/50 lg:hidden"
        />
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onOpen={() => setMenuOpen(true)} />
        <Outlet />
      </main>
    </div>
  )
}

/**
 * Barre superieure du telephone : elle ne porte que l'ouverture du menu et le
 * nom du centre. C'est elle qui reste collee en haut sur mobile — l'en-tête de
 * page, lui, defile, pour ne pas empiler deux bandeaux fixes sur un petit
 * écran (voir `PageHeader`).
 */
function MobileTopBar({ onOpen }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Ouvrir le menu"
        className="flex h-10 w-10 flex-none cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[9px] border border-line hover:border-brand"
      >
        {/* Trois barres dessinees en CSS : le projet n'embarque pas
            de bibliotheque d'icones, et trois <span> suffisent. */}
        <span className="block h-[2px] w-[18px] rounded-full bg-ink" />
        <span className="block h-[2px] w-[18px] rounded-full bg-ink" />
        <span className="block h-[2px] w-[18px] rounded-full bg-ink" />
      </button>

      <ButterflyMark size={30} radius={9} />
      <div className="min-w-0">
        <div className="text-[14px] font-bold leading-tight tracking-[-0.01em]">BlueCare</div>
        <div className="truncate text-[10px] font-medium uppercase tracking-[0.06em] text-muted">
          Centre Papillon Bleu
        </div>
      </div>
    </header>
  )
}

export default AppLayout
