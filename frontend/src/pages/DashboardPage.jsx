import { useNavigate } from 'react-router-dom'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import { ChartLegend, GroupedBarChart } from '@/components/ui/charts.jsx'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  EmptyState,
  ProgressBar,
  SectionLabel,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { useApi } from '@/hooks/useApi.js'
import { useAuth } from '@/hooks/useAuth.js'
import { percent, todayIso } from '@/lib/format.js'
import { roleLabel } from '@/lib/roles.js'
import {
  fetchAttendanceSheet,
  fetchDashboard,
  fetchMedicationDoses,
  fetchNotifications,
  fetchPendingReports,
} from '@/api/tracking.api.js'
import { apiClient, query } from '@/api/client.js'

/**
 * Tableau de bord.
 *
 * La maquette montre un seul écran decline par rôle. Le backend n'expose
 * `/dashboard` qu'a la direction : les autres rôles composent la même vue a
 * partir des ressources auxquelles ils ont droit. Chaque bloc affiche donc de
 * vraies données, ou rien.
 */

const SEVERITY_TONE = { critical: 'danger', warning: 'warn', info: 'neutral' }
const SEVERITY_DOT = { critical: '#C0405A', warning: '#C77A0A', info: '#6C9BF0' }

const STATUS_TONE = {
  completed: 'success',
  planned: 'neutral',
  cancelled: 'danger',
}

const STATUS_LABEL = {
  completed: 'Réalisée',
  planned: 'Planifiée',
  cancelled: 'Annulée',
}

/*
 * Les six requêtes du tableau de bord partent **ensemble**.
 *
 * Elles etaient enchainees : la vue direction attendait le récapitulatif, puis
 * la feuille de présence, puis les prises de médicaments — trois allers-retours
 * bout a bout alors qu'aucun ne depend du precedent. C'est le premier écran
 * après la connexion, donc celui sur lequel se juge la rapidite de
 * l'application ; il ne coute plus que le plus lent des six appels.
 *
 * Chaque requête absorbe son erreur : un bloc indisponible laisse un trou dans
 * la page, il n'emporte pas le tableau de bord entier.
 */
async function loadDashboard(role) {
  const today = todayIso()
  const isDirector = role === 'director'
  const isNurse = role === 'nurse'

  const [notifications, pending, sessions, overview, sheet, doses] = await Promise.all([
    fetchNotifications().catch(() => ({ items: [], summary: null })),
    isNurse
      ? { items: [], summary: { total: 0, overdue: 0 } }
      : fetchPendingReports().catch(() => ({ items: [], summary: { total: 0, overdue: 0 } })),
    apiClient
      .get(`/sessions${query({ from: today, to: today })}`)
      .then((body) => body.data)
      .catch(() => []),
    // La direction dispose d'un endpoint d'agregation ; les autres non.
    isDirector ? fetchDashboard().catch(() => null) : null,
    fetchAttendanceSheet({ date: today }).catch(() => null),
    isNurse || isDirector ? fetchMedicationDoses({ date: today }).catch(() => null) : null,
  ])

  return { notifications, pending, sessions, overview, sheet, doses }
}

/** Message de priorité du jour, calcule sur les chiffres réellement charges. */
function focusFor(role, data) {
  const pending = data.pending.summary?.total ?? 0
  const pendingDoses = data.doses?.summary?.pending ?? 0
  const missing = data.sheet?.summary?.missing ?? 0

  if (role === 'nurse') {
    return {
      title: pendingDoses > 0 ? `${pendingDoses} prise${pendingDoses > 1 ? 's' : ''} de médicament a tracer` : 'Aucune prise en attente',
      text:
        pendingDoses > 0
          ? 'Les rappels disparaissent des que la prise est enregistrée. Les absences répétées demandent aussi un avis santé.'
          : 'Toutes les prises prévues aujourd\'hui sont tracées.',
      cta: 'Ouvrir les médicaments',
      to: '/medicaments',
    }
  }

  if (role === 'director') {
    return {
      title: pending > 0 ? `${pending} compte${pending > 1 ? 's' : ''}-rendu${pending > 1 ? 's' : ''} en attente` : 'Aucun compte-rendu en retard',
      text:
        'Vue globale du centre : présences, progression moyenne et rapports a exporter pour les familles.',
      cta: 'Voir les enfants',
      to: '/enfants',
    }
  }

  return {
    title: pending > 0 ? `${pending} compte${pending > 1 ? 's' : ''}-rendu${pending > 1 ? 's' : ''} a saisir` : 'Vos comptes-rendus sont à jour',
    text:
      missing > 0
        ? `${missing} enfant${missing > 1 ? 's' : ''} sans saisie de présence aujourd'hui. Les observations manquantes bloquent le recalcul des taux d'avancement.`
        : 'Les observations manquantes bloquent le recalcul des taux d\'avancement.',
    cta: 'Saisir un compte-rendu',
    to: '/comptes-rendus',
  }
}

function kpisFor(role, data) {
  const sheet = data.sheet?.summary
  const overview = data.overview

  const recorded = sheet ? sheet.total - sheet.missing : 0
  const presentToday = sheet ? sheet.present + sheet.late : 0
  const todayRate = recorded > 0 ? Math.round((presentToday / recorded) * 100) : null

  const kpis = [
    {
      label: role === 'director' ? 'Taux de présence (30 j)' : 'Présence du jour',
      value: role === 'director' ? percent(overview?.attendance?.presenceRate) : percent(todayRate),
      delta: sheet ? `${recorded}/${sheet.total} saisis` : '—',
      bar: role === 'director' ? (overview?.attendance?.presenceRate ?? 0) : (todayRate ?? 0),
      color: '#1E5FD8',
    },
    {
      label: 'Progression moyenne',
      value: percent(overview?.progress?.averageProgress),
      delta: overview ? `${overview.progress.activeGoals} objectifs actifs` : 'direction',
      bar: overview?.progress?.averageProgress ?? 0,
      color: '#14866B',
    },
    {
      label: 'Séances du jour',
      value: String(data.sessions.length),
      delta: `${data.sessions.filter((session) => session.status === 'completed').length} réalisées`,
      bar: data.sessions.length === 0 ? 0 : (data.sessions.filter((s) => s.status === 'completed').length / data.sessions.length) * 100,
      color: '#6C9BF0',
    },
    {
      label: 'Comptes-rendus en attente',
      value: String(data.pending.summary?.total ?? 0),
      delta: `${data.pending.summary?.overdue ?? 0} en retard`,
      bar: Math.min(100, (data.pending.summary?.total ?? 0) * 10),
      color: '#C77A0A',
    },
  ]

  // L'infirmière n'a pas accès'a la progression pédagogique agregee.
  if (role === 'nurse') {
    kpis[1] = {
      label: 'Prises a tracer',
      value: String(data.doses?.summary?.pending ?? 0),
      delta: `sur ${data.doses?.summary?.total ?? 0} prévues`,
      bar: data.doses?.summary?.total
        ? ((data.doses.summary.total - data.doses.summary.pending) / data.doses.summary.total) * 100
        : 0,
      color: '#14866B',
    }
    kpis[3] = {
      label: 'Alertes de santé',
      value: String(data.notifications.summary?.byType?.['health-alert'] ?? 0),
      delta: 'sur 7 jours',
      bar: Math.min(100, (data.notifications.summary?.byType?.['health-alert'] ?? 0) * 20),
      color: '#C0405A',
    }
  }

  return kpis
}

function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useApi(() => loadDashboard(user.role), [user.role], {
    cache: 'dashboard',
  })

  const crumb = { educator: 'Mes séances', nurse: 'Suivi santé', director: 'Vue direction' }[user.role]
  const title = { educator: 'Ma journee', nurse: 'Tableau de bord santé', director: 'Tableau de bord' }[user.role]

  return (
    <>
      <PageHeader
        crumb={crumb}
        title={title}
        action={
          user.role === 'educator' ? (
            <Button onClick={() => navigate('/comptes-rendus')}>+ Compte-rendu</Button>
          ) : user.role === 'nurse' ? (
            <Button onClick={() => navigate('/medicaments')}>Rappels du jour</Button>
          ) : (
            <Button onClick={() => navigate('/enfants')}>Voir les enfants</Button>
          )
        }
      />

      <PageBody>
        <ErrorNotice error={error} onRetry={reload} />

        {loading ? (
          <div className="flex flex-col gap-[22px]">
            <Skeleton height={112} className="rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} height={118} className="rounded-2xl" />
              ))}
            </div>
            <Skeleton height={300} className="rounded-2xl" />
          </div>
        ) : data ? (
          <DashboardContent data={data} role={user.role} navigate={navigate} />
        ) : null}
      </PageBody>
    </>
  )
}

function DashboardContent({ data, role, navigate }) {
  const focus = focusFor(role, data)
  const kpis = kpisFor(role, data)
  const alerts = data.notifications.items.slice(0, 5)

  const groups = data.overview
    ? data.overview.progress.byGroup.map((entry) => ({
        label: entry.group,
        values: [entry.averageProgress ?? 0],
      }))
    : []

  return (
    <>
      {/*
        Le bouton passe sous le texte en dessous de 640 px : garde-t-il sa place
        a droite, son `whitespace-nowrap` reduit le titre a une colonne de
        quelques caracteres sur un telephone.
      */}
      <Card className="flex animate-up flex-col items-start gap-4 px-5 py-5 sm:flex-row sm:items-center sm:gap-[26px] sm:px-6 sm:py-[22px]">
        <div className="min-w-0 flex-1">
          <SectionLabel className="mb-2">Votre priorité du jour · {roleLabel(role)}</SectionLabel>
          <div className="mb-1.5 text-[17px] font-bold tracking-[-0.02em] sm:text-[19px]">
            {focus.title}
          </div>
          <div className="max-w-[620px] text-[13.5px] leading-relaxed text-muted-strong">{focus.text}</div>
        </div>
        <Button
          onClick={() => navigate(focus.to)}
          className="w-full whitespace-nowrap px-[18px] sm:w-auto"
        >
          {focus.cta}
        </Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => (
          <Card
            key={kpi.label}
            className="flex animate-up flex-col gap-2.5 px-5 py-[18px] hover:border-brand-100 hover:shadow-card"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="text-[11.5px] font-semibold text-muted-strong">{kpi.label}</div>
            <div className="flex items-end gap-2">
              <div className="text-3xl font-bold leading-none tracking-[-0.03em]">{kpi.value}</div>
              <div className="pb-[3px] text-xs font-semibold text-success">{kpi.delta}</div>
            </div>
            <ProgressBar value={kpi.bar} color={kpi.color} height={5} />
          </Card>
        ))}
      </div>

      <div className="grid gap-[18px] xl:grid-cols-[1.55fr_1fr] xl:items-start">
        <Card className="px-5 py-5 sm:px-6 sm:py-[22px]">
          <CardHeader
            className="mb-[22px]"
            title={role === 'director' ? 'Progression moyenne par groupe' : 'Séances du jour'}
            subtitle={
              role === 'director'
                ? "Taux d'avancement des objectifs, par groupe éducatif"
                : `${data.sessions.length} séance${data.sessions.length > 1 ? 's' : ''} programmee${data.sessions.length > 1 ? 's' : ''}`
            }
          />

          {role === 'director' ? (
            <>
              <GroupedBarChart
                groups={groups}
                series={[{ label: 'Avancement moyen', color: '#1E5FD8' }]}
                emptyLabel="Aucun objectif enregistre"
              />
              <div className="mt-3.5 border-t border-line-soft pt-4">
                <ChartLegend series={[{ label: 'Avancement moyen des objectifs', color: '#1E5FD8' }]} />
              </div>
            </>
          ) : (
            <SessionsTable sessions={data.sessions} navigate={navigate} />
          )}
        </Card>

        <div className="flex flex-col gap-[18px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 pb-3.5 pt-[18px]">
              <div className="text-[15px] font-bold tracking-[-0.01em]">Alertes en cours</div>
              <Badge tone={alerts.length > 0 ? 'danger' : 'neutral'}>
                {data.notifications.summary?.total ?? alerts.length}
              </Badge>
            </div>

            {alerts.length === 0 ? (
              <div className="border-t border-line-soft px-5 py-6 text-[12.5px] text-muted">
                Rien a signaler pour le moment.
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 border-t border-line-soft px-5 py-3.5 hover:bg-[#FAFBFE]"
                >
                  <span
                    className="mt-[5px] h-[9px] w-[9px] flex-none rounded-full"
                    style={{ background: SEVERITY_DOT[alert.severity] ?? '#6C9BF0' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-[3px] text-[13px] font-semibold text-ink">{alert.title}</div>
                    <div className="text-xs leading-[1.45] text-muted">{alert.message}</div>
                  </div>
                  <Badge tone={SEVERITY_TONE[alert.severity] ?? 'neutral'}>{alert.severity}</Badge>
                </div>
              ))
            )}
          </Card>

          <Card className="border-0 bg-navy px-[22px] py-5 text-white">
            <div className="mb-1 text-[14.5px] font-bold">Comptes-rendus en attente</div>
            <div className="mb-[18px] text-xs text-onnavy-soft">
              Séances passees sans compte-rendu dépose
            </div>
            <div className="mb-[18px] flex items-end gap-2.5">
              <div className="text-[40px] font-bold leading-none tracking-[-0.03em]">
                {data.pending.summary?.total ?? 0}
              </div>
              <div className="pb-[5px] text-xs text-onnavy-soft">
                dont {data.pending.summary?.overdue ?? 0}
                <br />
                en retard
              </div>
            </div>
            <Button onClick={() => navigate('/comptes-rendus')} className="w-full hover:bg-[#3D78E8]">
              Ouvrir la file de saisie
            </Button>
          </Card>
        </div>
      </div>

      {role === 'director' ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-soft px-5 pb-4 pt-5 sm:px-6">
            <CardHeader
              title="Séances du jour"
              subtitle={`${data.sessions.length} séance${data.sessions.length > 1 ? 's' : ''} programmee${data.sessions.length > 1 ? 's' : ''}`}
            />
          </div>
          <SessionsTable sessions={data.sessions} navigate={navigate} flush />
        </Card>
      ) : null}
    </>
  )
}

function SessionsTable({ sessions, navigate, flush = false }) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Aucune séance aujourd'hui"
        description="Les séances planifiées apparaitront ici le jour venu."
      />
    )
  }

  return (
    <div className={flush ? '' : 'mt-2 overflow-hidden rounded-xl border border-line-soft'}>
      {/*
        Quatre colonnes ne se compriment pas sous 620 px sans devenir
        illisibles : le tableau defile horizontalement plutôt que d'ecraser
        chaque cellule sur trois lignes.
      */}
      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] bg-[#FAFBFE] px-6 py-[11px] text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">
            <div>Enfant</div>
            <div>Type</div>
            <div>Objectif travaille</div>
            <div>Statut</div>
          </div>

          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => navigate(`/enfants/${session.childId}`)}
              className="grid w-full grid-cols-[1.4fr_1fr_1fr_0.9fr] items-center border-t border-line-soft px-6 py-3.5 text-left hover:bg-[#FAFBFE]"
            >
              <div className="flex items-center gap-[11px]">
                <Avatar color="#1E5FD8">{session.title?.slice(0, 2).toUpperCase() ?? 'SE'}</Avatar>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold">
                    {session.title ?? 'Séance'}
                  </div>
                  <div className="font-mono text-[11px] text-muted-light">
                    {session.startTime ?? '—'}
                  </div>
                </div>
              </div>
              <div className="text-[13px] text-muted-strong">{session.type}</div>
              <div className="text-[13px] text-muted-strong">
                {session.goalIds?.length ? `${session.goalIds.length} objectif(s)` : '—'}
              </div>
              <div>
                <Badge tone={STATUS_TONE[session.status]}>{STATUS_LABEL[session.status]}</Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
