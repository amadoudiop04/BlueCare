import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageHeader, { HeaderSearch, PageBody } from '@/components/layout/PageHeader.jsx'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { fetchChildren, fetchGoals } from '@/api/children.api.js'
import { fetchReference } from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { useAuth } from '@/hooks/useAuth.js'
import { formatDate, initials, percent, progressTone } from '@/lib/format.js'
import { prefetchPath } from '@/lib/routes.js'
import { cx } from '@/lib/ui.js'

/**
 * Liste des enfants accompagnés.
 *
 * La progression affichée sur chaque carte vient d'un unique appel a `/goals`
 * (tous les objectifs du périmètre), regroupe côté client. Interroger
 * `/children/:id/goals` par carte ferait une requête par enfant.
 */

async function loadChildren(status) {
  const [{ items }, goals, reference] = await Promise.all([
    fetchChildren({ pageSize: 100, status }),
    fetchGoals().catch(() => []),
    fetchReference().catch(() => null),
  ])

  const progressByChild = new Map()
  for (const goal of goals) {
    if (!progressByChild.has(goal.childId)) progressByChild.set(goal.childId, [])
    progressByChild.get(goal.childId).push(goal)
  }

  return {
    children: items.map((child) => {
      const childGoals = progressByChild.get(child.id) ?? []
      const average =
        childGoals.length === 0
          ? null
          : Math.round(childGoals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0) / childGoals.length)

      return { ...child, goalCount: childGoals.length, averageProgress: average }
    }),
    groups: reference?.groups ?? [],
    disabilityLabels: Object.fromEntries(
      (reference?.disabilityTypes ?? []).map((option) => [option.value, option.label]),
    ),
  }
}

/*
 * La direction inscrit dans n'importe quel groupe, l'éducateur dans les siens
 * (le serveur borne le groupe, voir `access.service.js`). L'infirmière ne cree
 * pas de fiche : elle suit les traitements de celles qui existent.
 */
function ChildrenPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // `active` par défaut : les fiches archivees ne polluent pas la liste, mais
  // restent atteignables — sans ce filtre, archiver reviendrait a perdre l'enfant.
  const [status, setStatus] = useState('active')
  const { data, error, loading, reload } = useApi(() => loadChildren(status), [status], {
    cache: 'children',
  })

  const [search, setSearch] = useState('')
  const [group, setGroup] = useState(null)

  const visible = useMemo(() => {
    if (!data) return []
    const needle = search.trim().toLowerCase()

    return data.children.filter((child) => {
      if (group && child.group !== group) return false
      if (!needle) return true
      return `${child.firstName} ${child.lastName}`.toLowerCase().includes(needle)
    })
  }, [data, search, group])

  const groups = data?.groups ?? []
  const canCreate = ['educator', 'director', 'admin'].includes(user.role)

  return (
    <>
      <PageHeader
        crumb="Gestion des enfants"
        title="Enfants accompagnés"
        search={<HeaderSearch value={search} onChange={setSearch} />}
        action={
          canCreate ? (
            <Button
              onClick={() => navigate('/enfants/nouveau')}
              onMouseEnter={() => prefetchPath('/enfants/nouveau')}
            >
              + Nouvel enfant
            </Button>
          ) : null
        }
      />

      <PageBody>
        <ErrorNotice error={error} onRetry={reload} />

        {/*
          Deux filtres independants — le groupe et le statut — d'ou deux lignes
          distinctes. Melanges sur une seule, « Archives » passait pour un
          groupe de plus : on cliquait ensuite sur « Les Bleuets » en croyant
          revenir aux fiches actives, et la liste restait dans les archives sans
          que rien ne l'explique.
        */}
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterChip active={group === null} onClick={() => setGroup(null)}>
            Tous les groupes
          </FilterChip>
          {groups.map((entry) => (
            <FilterChip key={entry} active={group === entry} onClick={() => setGroup(entry)}>
              {entry}
            </FilterChip>
          ))}

          <div className="flex-1" />
          <span className="text-[12.5px] text-muted">
            {loading ? '…' : `${visible.length} enfant${visible.length > 1 ? 's' : ''}`}
            {user.role === 'educator' ? ' dans vos groupes' : ' accompagnés'}
            {status === 'archived' ? ' · archives' : ''}
          </span>
        </div>

        <div className="-mt-2.5 flex flex-wrap items-center gap-2.5">
          <span className="text-[12.5px] font-semibold text-muted">Statut</span>
          <FilterChip active={status === 'active'} onClick={() => setStatus('active')}>
            Fiches actives
          </FilterChip>
          <FilterChip active={status === 'archived'} onClick={() => setStatus('archived')}>
            Archives
          </FilterChip>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} height={210} className="rounded-2xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              status === 'archived'
                ? group
                  ? `Aucune fiche archivee dans ${group}`
                  : 'Aucune fiche archivee'
                : 'Aucun enfant a afficher'
            }
            description={
              status === 'archived'
                ? 'Les fiches des enfants sortis du centre apparaissent ici. Les fiches en cours sont sous « Fiches actives ».'
                : search || group
                  ? 'Aucun enfant ne correspond a ce filtre.'
                  : "Votre périmètre ne contient aucun enfant pour l'instant."
            }
            /*
             * Une liste vide sans rien a faire est une impasse. Depuis les
             * archives, la sortie est de revenir aux fiches actives — c'est ce
             * que cherche quiconque atterrit ici par erreur. Ailleurs, et quand
             * le rôle le permet, c'est la création qui part d'ici.
             */
            action={
              status === 'archived' ? (
                <Button onClick={() => setStatus('active')}>
                  {group ? `Voir les fiches actives de ${group}` : 'Voir les fiches actives'}
                </Button>
              ) : canCreate && !search && !group ? (
                <Button onClick={() => navigate('/enfants/nouveau')}>
                  Créer la première fiche
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((child, index) => (
              <ChildCard
                key={child.id}
                child={child}
                disabilityLabel={data.disabilityLabels[child.disability?.type]}
                onOpen={() => navigate(`/enfants/${child.id}`)}
                index={index}
              />
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'cursor-pointer rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold',
        active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-muted-strong hover:border-brand',
      )}
    >
      {children}
    </button>
  )
}

function ChildCard({ child, disabilityLabel, onOpen, index }) {
  const tone = progressTone(child.averageProgress ?? 0)

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      // Toutes les fiches partagent le même fichier : survoler une carte suffit
      // a le telecharger, et les suivantes s'ouvrent alors sans attente.
      onMouseEnter={() => prefetchPath(`/enfants/${child.id}`)}
      onFocus={() => prefetchPath(`/enfants/${child.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className="flex animate-up cursor-pointer flex-col gap-4 p-5 hover:-translate-y-[3px] hover:border-brand hover:shadow-lift"
      style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
    >
      <div className="flex items-center gap-3">
        <Avatar color={tone.avatar} size={40} radius={12}>
          {initials(child.firstName, child.lastName)}
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold tracking-[-0.01em]">
            {child.firstName} {child.lastName}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {child.age} ans · <span className="font-mono">{child.id.slice(0, 12)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {child.status === 'archived' ? (
          <span className="rounded-md bg-canvas px-2.5 py-1 text-[11px] font-semibold text-muted">
            Archivee
          </span>
        ) : null}
        <span className="rounded-md bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-dark">
          {child.group}
        </span>
        {disabilityLabel ? (
          <span className="rounded-md bg-canvas px-2.5 py-1 text-[11px] font-semibold text-muted-strong">
            {disabilityLabel}
          </span>
        ) : null}
      </div>

      <div>
        <div className="mb-[7px] flex justify-between text-[11.5px] font-semibold text-muted-strong">
          <span>Progression globale</span>
          <span className="font-mono text-ink">{percent(child.averageProgress)}</span>
        </div>
        <ProgressBar value={child.averageProgress ?? 0} color={tone.bar} />
      </div>

      <div className="flex items-center justify-between border-t border-line-soft pt-3 text-[11.5px] text-muted">
        <span>
          {child.goalCount} objectif{child.goalCount > 1 ? 's' : ''}
        </span>
        <span>Entree · {formatDate(child.enrolledAt)}</span>
      </div>
    </Card>
  )
}

export default ChildrenPage
