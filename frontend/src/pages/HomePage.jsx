import AppLayout from '@/components/layout/AppLayout.jsx'
import StatusBadge from '@/components/ui/StatusBadge.jsx'
import { useHealth } from '@/hooks/useHealth.js'

const LABELS = {
  loading: 'Connexion au backend...',
  ok: 'Backend connecte',
  error: 'Backend injoignable',
}

function HomePage() {
  const status = useHealth()

  return (
    <AppLayout>
      <h1 className="text-3xl font-bold underline">Hello World</h1>
      <p className="mt-2 text-slate-600">
        Le frontend et le backend sont en place. Remplace cette page par ton contenu.
      </p>
      <div className="mt-6">
        <StatusBadge status={status}>{LABELS[status]}</StatusBadge>
      </div>
    </AppLayout>
  )
}

export default HomePage
