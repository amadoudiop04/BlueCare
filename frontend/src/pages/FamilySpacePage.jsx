import { useState } from 'react'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import { ChartLegend, LineChart } from '@/components/ui/charts.jsx'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { apiClient } from '@/api/client.js'
import { fetchChildProgress, fetchChildren, progressReportPath } from '@/api/children.api.js'
import { useApi } from '@/hooks/useApi.js'
import { monthLabel, percent } from '@/lib/format.js'

/**
 * Espace famille : progression de l'enfant, en lecture seule.
 *
 * La famille ne voit ni les observations detaillees des seances, ni les
 * donnees medicales — le serveur ne les lui renvoie pas, et cet ecran ne
 * demande que ce a quoi elle a droit.
 */

const SERIES_COLORS = ['#1E5FD8', '#14866B', '#6C9BF0', '#C77A0A']

async function loadFamilySpace() {
  const { items } = await fetchChildren({ pageSize: 10 })
  if (items.length === 0) return { child: null, progress: null }

  const child = items[0]
  const progress = await fetchChildProgress(child.id, { months: 6 })

  return { child, progress }
}

function FamilySpacePage() {
  const { data, error, loading, reload } = useApi(loadFamilySpace, [])
  const [exporting, setExporting] = useState(false)

  const download = async () => {
    setExporting(true)
    try {
      const response = await apiClient.raw(progressReportPath(data.child.id, 6))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `progression-${data.child.lastName}.pdf`.toLowerCase()
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader crumb="Acces securise" title="Espace famille" />

      <PageBody>
        <ErrorNotice error={error} onRetry={reload} />

        {loading ? (
          <Skeleton height={420} className="rounded-2xl" />
        ) : !data?.child ? (
          <EmptyState
            title="Aucun enfant rattache a ce compte"
            description="Contactez la direction du centre pour faire rattacher votre enfant."
          />
        ) : (
          <FamilyContent data={data} onExport={download} exporting={exporting} />
        )}
      </PageBody>
    </>
  )
}

function FamilyContent({ data, onExport, exporting }) {
  const { child, progress } = data

  const tracked = progress.goals.filter((entry) => entry.points.length > 0)
  const labels = (progress.goals[0]?.monthly ?? []).map((entry) => monthLabel(entry.month))
  const series = tracked.slice(0, 4).map((entry, index) => ({
    label: entry.goal.title,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: entry.monthly.map((month) => month.average),
  }))

  return (
    <div className="mx-auto flex w-full max-w-[840px] flex-col gap-[18px]">
      <Card className="border-0 bg-navy px-8 py-[30px] text-white">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-onnavy-dim">
          Espace famille · lecture seule
        </div>
        <div className="mb-2 text-[25px] font-bold tracking-[-0.02em]">
          Progression de {child.firstName}
        </div>
        <div className="max-w-[540px] text-[13.5px] leading-relaxed text-onnavy-soft">
          Periode du {progress.period.from} au {progress.period.to}. Les observations detaillees de
          l equipe et les donnees medicales ne sont pas partagees.
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Avancement moyen"
          value={percent(progress.summary.averageProgress)}
          detail={`${progress.summary.goals} objectif${progress.summary.goals > 1 ? 's' : ''} suivi${progress.summary.goals > 1 ? 's' : ''}`}
          bar={progress.summary.averageProgress ?? 0}
          color="#1E5FD8"
        />
        <SummaryCard
          label="Seances realisees"
          value={String(progress.summary.sessionsCompleted)}
          detail={`${progress.summary.reports} compte${progress.summary.reports > 1 ? 's' : ''}-rendu${progress.summary.reports > 1 ? 's' : ''}`}
          bar={Math.min(100, progress.summary.sessionsCompleted * 5)}
          color="#14866B"
        />
      </div>

      {progress.goals.length > 0 ? (
        <Card className="px-6 py-[22px]">
          <CardHeader className="mb-4" title="Objectifs travailles" subtitle="Taux d avancement actuel" />
          <div className="flex flex-col gap-3.5">
            {progress.goals.map((entry, index) => (
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
        </Card>
      ) : null}

      <Card className="px-6 py-[22px]">
        <CardHeader
          className="mb-[18px]"
          title="Evolution sur 6 mois"
          subtitle="Un point par seance evaluee"
          action={series.length > 0 ? <ChartLegend series={series} shape="line" /> : null}
        />
        <LineChart
          series={series}
          labels={labels}
          emptyLabel="L evolution apparaitra apres les premieres seances"
        />
      </Card>

      <Card className="px-6 py-[22px]">
        <div className="mb-2 text-[15px] font-bold">Rapport de progression</div>
        <div className="mb-[18px] text-[13.5px] leading-relaxed text-muted-strong">
          Le rapport PDF reprend les objectifs, l avancement et la presence sur la periode. Il ne
          contient ni note interne, ni nom d autre enfant.
        </div>
        <Button onClick={onExport} disabled={exporting}>
          {exporting ? 'Generation…' : 'Telecharger le rapport PDF'}
        </Button>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, detail, bar, color }) {
  return (
    <Card className="px-[22px] py-5">
      <div className="mb-3 text-[13px] font-semibold text-muted-strong">{label}</div>
      <div className="mb-3 flex items-end gap-2">
        <div className="text-[27px] font-bold leading-none tracking-[-0.02em]">{value}</div>
        <div className="pb-[3px] text-xs font-semibold text-success">{detail}</div>
      </div>
      <ProgressBar value={bar} color={color} />
    </Card>
  )
}

export default FamilySpacePage
