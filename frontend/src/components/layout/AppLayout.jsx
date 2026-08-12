import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import CommandPalette from '@/components/layout/CommandPalette.jsx'
import RouteProgress from '@/components/layout/RouteProgress.jsx'
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
  const { pathname } = useLocation()

  useEffect(() => {
    if (!menuOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  /*
   * Le tiroir recouvre l'écran sur telephone. Sans ce verrou, le doigt qui
   * glisse dessus fait defiler la page en dessous : on referme le menu pour
   * retrouver un écran qui n'est plus au même endroit qu'on l'a laisse.
   */
  useEffect(() => {
    if (!menuOpen) return undefined

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  /*
   * Remise a zero du defilement d'un écran a l'autre.
   *
   * Une application monopage ne rechargeant rien, la position de defilement
   * survit a la navigation : depuis le bas d'une longue fiche enfant, ouvrir
   * les présences les affichait au milieu du tableau, sans en-tête ni titre —
   * l'écran semblait avoir mal charge.
   */
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      {/*
       * Premier arrêt de la tabulation : sans lui, atteindre le contenu au
       * clavier demande de traverser les huit liens de la barre laterale a
       * chaque changement d'écran.
       */}
      <a
        href="#contenu"
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-brand focus:shadow-lift"
      >
        Aller au contenu
      </a>

      <Sidebar badges={badges} open={menuOpen} onClose={() => setMenuOpen(false)} />

      {menuOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-navy/50 lg:hidden"
        />
      ) : null}

      <main id="contenu" className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onOpen={() => setMenuOpen(true)} />
        {/*
         * Frontière d'attente posee ici, et non autour de toute l'application :
         * pendant qu'un écran se telecharge, la barre laterale et la barre du
         * telephone restent en place. Seule la zone de contenu attend.
         */}
        <Suspense fallback={<RouteProgress />}>
          <Outlet />
        </Suspense>
      </main>

      <CommandPalette />
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
