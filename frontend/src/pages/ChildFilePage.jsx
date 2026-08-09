import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import { ChartLegend, LineChart } from '@/components/ui/charts.jsx'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import ChildDangerZone from '@/features/children/ChildDangerZone.jsx'
import { apiClient } from '@/api/client.js'
import {
  fetchChild,
  fetchChildGallery,
  fetchChildGoals,
  fetchChildMedications,
  fetchChildProgress,
  fetchChildSessions,
  progressReportPath,
} from '@/api/children.api.js'
import { fetchReference } from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { useAuth } from '@/hooks/useAuth.js'
import { formatDate, initials, monthLabel, percent, splitDate } from '@/lib/format.js'
import { canReadMedical, canWrite } from '@/lib/roles.js'

/** Fiche individuelle : identite, objectifs, evolution, historique des seances. */

const GOAL_COLORS = ['#1E5FD8', '#14866B', '#6C9BF0', '#C77A0A', '#8A6FD1', '#0C1E42']

const MOOD_TONE = {
  'very-good': 'success',
  good: 'success',
  neutral: 'neutral',
  difficult: 'warn',
  'very-difficult': 'danger',
}

async function loadChildFile(childId, role) {
  const [child, goals, progress, sessions, gallery, reference] = await Promise.all([
    fetchChild(childId),
    fetchChildGoals(childId),
    fetchChildProgress(childId, { months: 6 }),
    canWrite(role) || role === 'nurse'
      ? fetchChildSessions(childId).catch(() => ({ items: [], summary: null }))
      : Promise.resolve({ items: [], summary: null }),
    fetchChildGallery(childId).catch(() => ({ items: [] })),
    fetchReference().catch(() => null),
  ])

  const medications = canReadMedical(role)
    ? await fetchChildMedications(childId).catch(() => [])
    : null

  return { child, goals, progress, sessions, gallery, medications, reference }
}

function ChildFilePage() {
  const { childId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data, error, loading, reload } = useApi(
    () => loadChildFile(childId, user.role),
    [childId, user.role],
  )

  const [exporting, setExporting] = useState(false)

  const downloadReport = async () => {
    setExporting(true)
    try {
      const response = await apiClient.raw(progressReportPath(childId, 6))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      // Le PDF part avec un en-tete d authentification : il faut passer par un
      // blob plutot que par un simple lien, qui n'emporterait pas le jeton.
      const link = document.createElement('a')
      link.href = url
      link.download = `progression-${data?.child?.lastName ?? 'enfant'}.pdf`.toLowerCase()
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
      <PageHeader
        crumb={data ? `Enfants · ${data.child.group}` : 'Enfants'}
        title={data ? `${data.child.firstName} ${data.child.lastName}` : 'Fiche individuelle'}
        action={
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={downloadReport} disabled={!data || exporting}>
              {exporting ? 'Generation…' : 'Rapport PDF'}
            </Button>
            {canWrite(user.role) ? (
              <Button onClick={() => navigate(`/comptes-rendus?enfant=${childId}`)}>
                Saisir un compte-rendu
              </Button>
            ) : null}
          </div>
        }
      />

      <PageBody>
        <ErrorNotice error={error} onRetry={reload} />

        {loading ? (
          <div className="grid gap-[18px] xl:grid-cols-[320px_1fr]">
            <Skeleton height={420} className="rounded-2xl" />
            <Skeleton height={520} className="rounded-2xl" />
          </div>
        ) : data ? (
          <div className="grid items-start gap-[18px] xl:grid-cols-[320px_1fr]">
            <div className="flex flex-col gap-[18px]">
              <IdentityCard child={data.child} reference={data.reference} />
              <MedicalCard medications={data.medications} role={user.role} />
              <GalleryCard items={data.gallery.items} />
            </div>

            <div className="flex flex-col gap-[18px]">
              <GoalsCard goals={data.goals} />
              <EvolutionCard progress={data.progress} />
              <SessionsCard sessions={data.sessions.items} canWrite={canWrite(user.role)} />

              {['director', 'admin'].includes(user.role) ? (
                <ChildDangerZone
                  child={data.child}
                  counts={{
                    goals: data.goals.items.length,
                    sessions: data.sessions.items.length,
                    medications: data.medications?.length ?? 0,
                  }}
                  onArchived={reload}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </PageBody>
    </>
  )
}

function IdentityCard({ child, reference }) {
  const disabilityLabel =
    reference?.disabilityTypes?.find((option) => option.value === child.disability?.type)?.label ??
    child.disability?.type

  const primaryContact =
    child.familyContacts?.find((contact) => contact.isPrimary) ?? child.familyContacts?.[0]

  const rows = [
    { key: 'Type de handicap', value: disabilityLabel },
    { key: 'Groupe', value: child.group },
    { key: 'Entree au centre', value: formatDate(child.enrolledAt) },
    { key: 'Date de naissance', value: `${formatDate(child.birthDate)} · ${child.age} ans` },
    {
      key: 'Famille',
      value: primaryContact
        ? `${primaryContact.firstName ?? ''} ${primaryContact.lastName} · ${primaryContact.phone}`.trim()
        : 'Non renseignee',
    },
    {
      key: 'Medecin referent',
      value: child.referringDoctor
        ? `${child.referringDoctor.lastName}${child.referringDoctor.specialty ? ` · ${child.referringDoctor.specialty}` : ''}`
        : 'Non communique',
    },
  ]

  return (
    <Card className="p-[22px]">
      <div className="flex flex-col items-center gap-3 border-b border-line-soft pb-[18px]">
        <Avatar size={68} radius={20}>
          {initials(child.firstName, child.lastName)}
        </Avatar>
        <div className="text-center">
          <div className="text-lg font-bold tracking-[-0.02em]">
            {child.firstName} {child.lastName}
          </div>
          <div className="mt-[3px] font-mono text-xs text-muted">{child.id}</div>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Badge tone="brand">{child.group}</Badge>
          <Badge tone={child.status === 'active' ? 'success' : 'neutral'}>
            {child.status === 'active' ? 'Accueilli' : child.status}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col pt-1.5">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex justify-between gap-3.5 border-b border-canvas py-[11px] text-[12.5px]"
          >
            <span className="whitespace-nowrap font-medium text-muted">{row.key}</span>
            <span className="text-right font-semibold text-ink">{row.value}</span>
          </div>
        ))}
      </div>

      {child.disability?.supportPlan ? (
        <div className="mt-4 rounded-xl bg-canvas px-3.5 py-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            Plan d accompagnement
          </div>
          <div className="text-[12.5px] leading-relaxed text-muted-strong">
            {child.disability.supportPlan}
          </div>
        </div>
      ) : null}
    </Card>
  )
}

/**
 * Volet medical. Pour un educateur, le serveur ne renvoie tout simplement pas
 * ces donnees : la carte reste visible mais explicitement fermee, plutot que
 * de disparaitre sans explication.
 */
function MedicalCard({ medications, role }) {
  if (!canReadMedical(role)) {
    return (
      <Card className="border-dashed bg-[#FAFBFE] p-5">
        <div className="mb-3.5 flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <div className="text-sm font-bold text-muted">Volet medical</div>
          <Badge tone="neutral" className="ml-auto">
            INFIRMIERE
          </Badge>
        </div>
        <div className="text-[12.5px] leading-relaxed text-muted">
          Les traitements et le medecin referent sont reserves a l infirmiere et a la direction.
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-danger" />
        <div className="text-sm font-bold">Volet medical</div>
        <Badge tone="danger" className="ml-auto">
          INFIRMIERE
        </Badge>
      </div>

      {!medications || medications.length === 0 ? (
        <div className="text-[12.5px] text-muted">Aucun traitement en cours.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {medications.map((medication) => (
            <div key={medication.id} className="text-[12.5px] leading-relaxed text-muted-strong">
              <span className="font-semibold text-ink">{medication.name}</span> · {medication.dosage}
              {medication.schedule?.times?.length ? (
                <>
                  {' — '}
                  {medication.schedule.times.map((time) => (
                    <strong key={time} className="text-ink">
                      {time}{' '}
                    </strong>
                  ))}
                </>
              ) : null}
              {medication.instructions ? (
                <div className="mt-1 text-muted">{medication.instructions}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function GalleryCard({ items }) {
  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="text-sm font-bold">Galerie d activites</div>
        <span className="text-[10.5px] font-semibold text-muted">Anonymisee</span>
      </div>

      {items.length === 0 ? (
        <div className="text-[12.5px] text-muted">Aucune activite enregistree.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {items.slice(0, 4).map((activity) => (
            <div
              key={activity.id}
              title={activity.title}
              className="flex aspect-square items-end rounded-[10px] border border-dashed border-line-strong p-2"
              style={{
                background:
                  'repeating-linear-gradient(135deg, #F7F9FC 0 6px, #EEF1F7 6px 12px)',
              }}
            >
              <span className="font-mono text-[9.5px] leading-tight text-muted line-clamp-3">
                {activity.title} · {formatDate(activity.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function GoalsCard({ goals }) {
  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-5"
        title="Objectifs pedagogiques"
        subtitle={
          goals.summary?.total
            ? `${goals.summary.active} en cours · ${goals.summary.achieved} atteints · moyenne ${percent(goals.summary.averageProgress)}`
            : 'Aucun objectif defini'
        }
      />

      {goals.items.length === 0 ? (
        <EmptyState
          title="Aucun objectif"
          description="Les objectifs pedagogiques definissent ce qui est travaille en seance."
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {goals.items.map((goal, index) => (
            <div key={goal.id} className="rounded-xl border border-line-soft px-[18px] py-4">
              <div className="mb-3 flex items-start gap-3.5">
                <div className="flex-1">
                  <div className="mb-1 text-sm font-semibold text-ink">{goal.title}</div>
                  <div className="text-xs text-muted">
                    {goal.domain}
                    {goal.targetDate ? ` · echeance ${formatDate(goal.targetDate)}` : ''}
                    {goal.status === 'achieved' ? ' · atteint' : ''}
                  </div>
                </div>
                <div className="font-mono text-[17px] font-medium text-ink">
                  {percent(goal.progress)}
                </div>
              </div>
              <ProgressBar
                value={goal.progress}
                color={GOAL_COLORS[index % GOAL_COLORS.length]}
                height={8}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function EvolutionCard({ progress }) {
  const tracked = progress.goals.filter((entry) => entry.points.length > 0).slice(0, 4)

  const labels = (progress.goals[0]?.monthly ?? []).map((entry) => monthLabel(entry.month))
  const series = tracked.map((entry, index) => ({
    label: entry.goal.title,
    color: GOAL_COLORS[index % GOAL_COLORS.length],
    points: entry.monthly.map((month) => month.average),
  }))

  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-[18px]"
        title="Evolution sur 6 mois"
        subtitle="Taux d avancement releve a chaque compte-rendu"
        action={series.length > 0 ? <ChartLegend series={series} shape="line" /> : null}
      />

      <LineChart
        series={series}
        labels={labels}
        emptyLabel="Aucun compte-rendu n a encore evalue ces objectifs"
      />
    </Card>
  )
}

function SessionsCard({ sessions, canWrite: writable }) {
  const withReport = sessions.filter((session) => session.report)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-6 pb-4 pt-5">
        <CardHeader
          title="Historique des seances"
          subtitle={`${sessions.length} seance${sessions.length > 1 ? 's' : ''} · ${withReport.length} avec compte-rendu`}
        />
      </div>

      {sessions.length === 0 ? (
        <div className="px-6 pb-6">
          <EmptyState
            title="Aucune seance"
            description={
              writable
                ? 'Creez une seance depuis l ecran Comptes-rendus.'
                : 'Les seances apparaitront ici une fois saisies.'
            }
          />
        </div>
      ) : (
        sessions.slice(0, 10).map((session) => {
          const { day, month } = splitDate(session.date)

          return (
            <div
              key={session.id}
              className="flex items-start gap-[18px] border-t border-line-soft px-6 py-4"
            >
              <div className="w-[62px] flex-none rounded-[9px] bg-canvas py-2 text-center">
                <div className="text-[17px] font-bold leading-none text-ink">{day}</div>
                <div className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {month}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <span className="text-[13.5px] font-semibold">
                    {session.title ?? session.type}
                  </span>
                  {session.report ? (
                    <Badge tone={MOOD_TONE[session.report.mood] ?? 'neutral'}>
                      {session.report.mood}
                    </Badge>
                  ) : (
                    <Badge tone="warn">Compte-rendu manquant</Badge>
                  )}
                </div>

                {session.report ? (
                  <div className="text-[12.5px] leading-[1.55] text-muted-strong">
                    {session.report.observations}
                  </div>
                ) : null}

                {session.report?.attentionPoints?.length ? (
                  <div className="mt-2.5 rounded-r-md border-l-[3px] border-warn bg-warn-bg px-3 py-2.5 text-xs leading-relaxed text-warn-ink">
                    Point d attention · {session.report.attentionPoints.join(' · ')}
                  </div>
                ) : null}

                {session.report?.healthFlag?.flagged ? (
                  <div className="mt-2.5 rounded-r-md border-l-[3px] border-danger bg-danger-bg px-3 py-2.5 text-xs leading-relaxed text-danger">
                    Signalement sante · {session.report.healthFlag.description}
                  </div>
                ) : null}
              </div>

              <div className="whitespace-nowrap text-[11.5px] text-muted-light">
                {session.goals?.length ? `${session.goals.length} obj.` : ''}
              </div>
            </div>
          )
        })
      )}
    </Card>
  )
}

export default ChildFilePage
