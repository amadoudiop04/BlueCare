import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import { ChartLegend, LineChart } from '@/components/ui/charts.jsx'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import {
  downloadProgressReport,
  fetchChildProgress,
  fetchChildren,
} from '@/api/children.api.js'
import { useApi } from '@/hooks/useApi.js'
import { useAuth } from '@/hooks/useAuth.js'
import { monthLabel, percent } from '@/lib/format.js'
import { cx, inputClass } from '@/lib/ui.js'

/**
 * Espace famille : progression d'un enfant, en lecture seule.
 *
 * La famille ne voit ni les observations détaillées des séances, ni les
 * données médicales — le serveur ne les lui renvoie pas, et cet écran ne
 * demande que ce a quoi elle a droit.
 *
 * L'écran est aussi ouvert a l'administration, qui l'utilise pour sortir le
 * rapport d'un enfant précis ou pour vérifier ce que la famille verra. La
 * liste proposee dans le selecteur est donc celle du périmètre de l'appelant :
 * ses propres enfants pour une famille, tout le centre pour un administrateur.
 */

const SERIES_COLORS = ['#1E5FD8', '#14866B', '#6C9BF0', '#C77A0A']

const PERIODS = [
  { months: 3, label: '3 mois' },
  { months: 6, label: '6 mois' },
  { months: 12, label: '12 mois' },
]

function FamilySpacePage() {
  const { user } = useAuth()
  const isFamily = user.role === 'family'

  const children = useApi(() => fetchChildren({ pageSize: 100 }), [])
  const items = useMemo(() => children.data?.items ?? [], [children.data])

  const [selectedId, setSelectedId] = useState(null)
  const [months, setMonths] = useState(6)
  const [download, setDownload] = useState({ busy: false, error: null, done: false })

  // Tant que rien n'est choisi, le premier enfant du périmètre : une famille
  // qui n'en a qu'un ne doit pas avoir a le selectionner.
  const child = items.find((entry) => entry.id === selectedId) ?? items[0] ?? null

  const progress = useApi(
    () => (child ? fetchChildProgress(child.id, { months }) : Promise.resolve(null)),
    [child?.id, months],
  )

  const choose = (value) => {
    setSelectedId(value)
    setDownload({ busy: false, error: null, done: false })
  }

  const choosePeriod = (value) => {
    setMonths(value)
    setDownload({ busy: false, error: null, done: false })
  }

  const onExport = async () => {
    setDownload({ busy: true, error: null, done: false })

    try {
      await downloadProgressReport(child, months)
      setDownload({ busy: false, error: null, done: true })
    } catch (error) {
      setDownload({ busy: false, error, done: false })
    }
  }

  return (
    <>
      <PageHeader
        crumb="Accès sécurisé"
        title="Espace famille"
        action={
          child && !isFamily ? (
            <Link
              to={`/enfants/${child.id}`}
              className="rounded-[9px] border border-line bg-white px-4 py-3 text-[13px] font-semibold text-ink hover:border-brand hover:text-brand"
            >
              Ouvrir la fiche complète
            </Link>
          ) : null
        }
      />

      <PageBody>
        <ErrorNotice error={children.error} onRetry={children.reload} />

        {children.loading ? (
          <Skeleton height={420} className="rounded-2xl" />
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucun enfant rattache a ce compte"
            description={
              isFamily
                ? 'Contactez la direction du centre pour faire rattacher votre enfant.'
                : "Aucune fiche n'est encore enregistrée : créez-en une depuis l'écran Enfants."
            }
          />
        ) : (
          <div className="mx-auto flex w-full max-w-[840px] flex-col gap-[18px]">
            {items.length > 1 ? (
              <ChildPicker
                items={items}
                selected={child}
                onSelect={choose}
                asStaff={!isFamily}
              />
            ) : null}

            <ErrorNotice error={progress.error} onRetry={progress.reload} />

            {progress.loading || !progress.data ? (
              <Skeleton height={420} className="rounded-2xl" />
            ) : (
              <FamilyContent
                child={child}
                progress={progress.data}
                months={months}
                onPeriodChange={choosePeriod}
                onExport={onExport}
                download={download}
                isFamily={isFamily}
              />
            )}
          </div>
        )}
      </PageBody>
    </>
  )
}

/**
 * Choix de l'enfant. Le `select` natif est ici le bon outil : il reste
 * utilisable au clavier, cherche a la frappe, et se replie tout seul sur le
 * selecteur du telephone — trois choses qu'une liste maison redonnerait a
 * écrire sans rien apporter.
 */
function ChildPicker({ items, selected, onSelect, asStaff }) {
  const groups = useMemo(() => {
    const byGroup = new Map()

    for (const child of items) {
      const key = child.group ?? 'Sans groupe'
      if (!byGroup.has(key)) byGroup.set(key, [])
      byGroup.get(key).push(child)
    }

    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
  }, [items])

  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-4"
        title="Enfant suivi"
        subtitle={
          asStaff
            ? `${items.length} enfants dans votre périmètre · la vue ci-dessous est celle de la famille`
            : `${items.length} enfants rattaches a votre compte`
        }
        action={selected ? <Badge tone="brand">{selected.group}</Badge> : null}
      />

      <select
        aria-label="Choisir un enfant"
        value={selected?.id ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        className={cx(inputClass, 'cursor-pointer')}
      >
        {groups.map(([group, entries]) => (
          <optgroup key={group} label={group}>
            {entries.map((child) => (
              <option key={child.id} value={child.id}>
                {child.firstName} {child.lastName}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </Card>
  )
}

function FamilyContent({
  child,
  progress,
  months,
  onPeriodChange,
  onExport,
  download,
  isFamily,
}) {
  const tracked = progress.goals.filter((entry) => entry.points.length > 0)
  const labels = (progress.goals[0]?.monthly ?? []).map((entry) => monthLabel(entry.month))
  const series = tracked.slice(0, 4).map((entry, index) => ({
    label: entry.goal.title,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: entry.monthly.map((month) => month.average),
  }))

  return (
    <>
      <Card className="border-0 bg-navy px-8 py-[30px] text-white">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-onnavy-dim">
          Espace famille · lecture seule
        </div>
        <div className="mb-2 text-[25px] font-bold tracking-[-0.02em]">
          Progression de {child.firstName}
        </div>
        <div className="max-w-[540px] text-[13.5px] leading-relaxed text-onnavy-soft">
          Période du {progress.period.from} au {progress.period.to}. Les observations détaillées de
          l'équipe et les données médicales ne sont pas partagees.
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
          label="Séances réalisées"
          value={String(progress.summary.sessionsCompleted)}
          detail={`${progress.summary.reports} compte${progress.summary.reports > 1 ? 's' : ''}-rendu${progress.summary.reports > 1 ? 's' : ''}`}
          bar={Math.min(100, progress.summary.sessionsCompleted * 5)}
          color="#14866B"
        />
      </div>

      {progress.goals.length > 0 ? (
        <Card className="px-6 py-[22px]">
          <CardHeader className="mb-4" title="Objectifs travailles" subtitle="Taux d'avancement actuel" />
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
          title={`Évolution sur ${months} mois`}
          subtitle="Un point par séance évaluée"
          action={series.length > 0 ? <ChartLegend series={series} shape="line" /> : null}
        />
        <LineChart
          series={series}
          labels={labels}
          emptyLabel="L'évolution apparaîtra après les premières séances"
        />
      </Card>

      <Card className="px-6 py-[22px]">
        <div className="mb-2 text-[15px] font-bold">Rapport de progression</div>
        <div className="mb-[18px] text-[13.5px] leading-relaxed text-muted-strong">
          Le rapport PDF de {child.firstName} {child.lastName} reprend les objectifs, l'avancement
          et la présence sur la période choisie. Il ne contient ni note interne, ni nom d'autre
          enfant{isFamily ? '' : ' : il peut être remis a la famille ou a un partenaire'}.
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12.5px] font-semibold text-muted">Période</span>
          {PERIODS.map((period) => (
            <button
              key={period.months}
              type="button"
              onClick={() => onPeriodChange(period.months)}
              aria-pressed={months === period.months}
              className={cx(
                'cursor-pointer rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold',
                months === period.months
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-white text-muted-strong hover:border-brand',
              )}
            >
              {period.label}
            </button>
          ))}
        </div>

        <ErrorNotice error={download.error} />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={onExport} disabled={download.busy}>
            {download.busy ? 'Génération…' : 'Telecharger le rapport PDF'}
          </Button>
          {download.done ? (
            <span className="text-[12.5px] font-semibold text-success">
              Rapport téléchargé.
            </span>
          ) : null}
        </div>
      </Card>
    </>
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
