import { useParams } from 'react-router-dom'

import DeveloperCredit from '@/components/layout/DeveloperCredit.jsx'
import ButterflyMark from '@/components/ui/ButterflyMark.jsx'
import { ChartLegend, LineChart } from '@/components/ui/charts.jsx'
import {
  Card,
  CardHeader,
  EmptyState,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { fetchSharedProgress } from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { formatDate, monthLabel, percent } from '@/lib/format.js'

/**
 * Consultation par lien sécurisé, sans compte.
 *
 * Le jeton est dans l URL : il porte lui-même sa portée (un enfant, lecture
 * seule) et expire au bout de sept jours. Aucun élément de navigation vers le
 * reste de l'application n'est affiche ici.
 */

const SERIES_COLORS = ['#1E5FD8', '#14866B', '#6C9BF0', '#C77A0A']

function SharedProgressPage() {
  const { token } = useParams()
  const { data, error, loading } = useApi(() => fetchSharedProgress(token), [token])

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[840px] items-center gap-3">
          <ButterflyMark size={34} radius={10} />
          <div>
            <div className="text-[15px] font-bold tracking-[-0.01em]">BlueCare</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">
              Centre Papillon Bleu
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[840px] px-6 py-8">
        {loading ? (
          <Skeleton height={420} className="rounded-2xl" />
        ) : error ? (
          <EmptyState
            title="Ce lien n'est plus valide"
            description="Les liens de suivi expirent au bout de sept jours. Demandez-en un nouveau au centre."
          />
        ) : (
          <SharedContent data={data} />
        )}

        <DeveloperCredit className="mt-8 text-center" />
      </main>
    </div>
  )
}

function SharedContent({ data }) {
  const labels = (data.goals[0]?.monthly ?? []).map((entry) => monthLabel(entry.month))
  const series = data.goals
    .filter((entry) => entry.points.length > 0)
    .slice(0, 4)
    .map((entry, index) => ({
      label: entry.goal.title,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points: entry.monthly.map((month) => month.average),
    }))

  return (
    <div className="flex flex-col gap-[18px]">
      <Card className="border-0 bg-navy px-8 py-[30px] text-white">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-onnavy-dim">
          Lien de suivi · lecture seule
        </div>
        <div className="mb-2 text-[25px] font-bold tracking-[-0.02em]">
          Progression de {data.child.firstName}
        </div>
        <div className="max-w-[540px] text-[13.5px] leading-relaxed text-onnavy-soft">
          Période du {formatDate(data.period.from)} au {formatDate(data.period.to)}. Les
          observations détaillées et les données médicales ne sont pas partagees.
        </div>
      </Card>

      <Card className="px-6 py-[22px]">
        <CardHeader className="mb-4" title="Objectifs suivis" subtitle="Taux d'avancement actuel" />

        {data.goals.length === 0 ? (
          <div className="text-[12.5px] text-muted">Aucun objectif défini sur la période.</div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {data.goals.map((entry, index) => (
              <div key={entry.goal.id}>
                <div className="mb-2 flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-ink">{entry.goal.title}</span>
                  <span className="font-mono text-muted-strong">{percent(entry.goal.progress)}</span>
                </div>
                <ProgressBar
                  value={entry.goal.progress}
                  color={SERIES_COLORS[index % SERIES_COLORS.length]}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="px-6 py-[22px]">
        <CardHeader
          className="mb-[18px]"
          title="Évolution sur 6 mois"
          action={series.length > 0 ? <ChartLegend series={series} shape="line" /> : null}
        />
        <LineChart series={series} labels={labels} emptyLabel="Pas encore de mesure sur la période" />
      </Card>
    </div>
  )
}

export default SharedProgressPage
