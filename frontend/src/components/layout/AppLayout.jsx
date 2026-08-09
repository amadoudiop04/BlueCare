import { Outlet } from 'react-router-dom'

import Sidebar from '@/components/layout/Sidebar.jsx'

/**
 * Structure de l application connectee : barre laterale fixe, contenu a droite.
 * Chaque page pose son propre en-tete via <PageHeader>, parce que le titre,
 * le fil d'ariane et l'action principale dependent de l ecran.
 */
function AppLayout({ badges }) {
  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar badges={badges} />
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
