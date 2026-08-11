import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageHeader, { HeaderSearch, PageBody } from '@/components/layout/PageHeader.jsx'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { fetchUsers } from '@/api/users.api.js'
import { useApi } from '@/hooks/useApi.js'
import { useAuth } from '@/hooks/useAuth.js'
import { initials } from '@/lib/format.js'
import { ROLE_LABELS } from '@/lib/roles.js'
import { cx } from '@/lib/ui.js'

/**
 * Comptes du centre. Reservee a la direction, comme tout `user.routes.js`.
 *
 * Les comptes desactives restent dans la liste : ils gardent des comptes-rendus
 * signes, et les masquer donnerait l'impression qu'ils ont disparu alors qu'ils
 * sont seulement empeches de se connecter.
 */

const ROLE_FILTERS = ['educator', 'nurse', 'family', 'director', 'admin']

/** Resume du perimetre, dans les mots de la page qui l'a defini. */
function scopeOf(account) {
  if (account.role === 'educator') {
    return account.groups?.length ? account.groups.join(', ') : 'Aucun groupe'
  }
  if (account.role === 'family') {
    const count = account.childIds?.length ?? 0
    return count === 0 ? 'Aucun enfant' : `${count} enfant${count > 1 ? 's' : ''}`
  }
  return 'Tout le centre'
}

function UsersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data, error, loading, reload } = useApi(() => fetchUsers({ pageSize: 100 }), [])

  const [search, setSearch] = useState('')
  const [role, setRole] = useState(null)

  const visible = useMemo(() => {
    const accounts = data?.items ?? []
    const needle = search.trim().toLowerCase()

    return accounts.filter((account) => {
      if (role && account.role !== role) return false
      if (!needle) return true
      return `${account.firstName} ${account.lastName} ${account.email}`
        .toLowerCase()
        .includes(needle)
    })
  }, [data, search, role])

  return (
    <>
      <PageHeader
        crumb="Gestion des comptes"
        title="Comptes du centre"
        search={<HeaderSearch value={search} onChange={setSearch} />}
        action={<Button onClick={() => navigate('/comptes/nouveau')}>+ Nouveau compte</Button>}
      />

      <PageBody>
        <ErrorNotice error={error} onRetry={reload} />

        <div className="flex flex-wrap items-center gap-2.5">
          <FilterChip active={role === null} onClick={() => setRole(null)}>
            Tous les rôles
          </FilterChip>
          {ROLE_FILTERS.map((entry) => (
            <FilterChip key={entry} active={role === entry} onClick={() => setRole(entry)}>
              {ROLE_LABELS[entry]}
            </FilterChip>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} height={72} className="rounded-2xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="Aucun compte ne correspond"
            description="Modifiez la recherche ou le filtre de rôle."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((account) => (
              <Card
                key={account.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/comptes/${account.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/comptes/${account.id}`)
                  }
                }}
                className={cx(
                  'flex cursor-pointer items-center gap-4 px-5 py-4',
                  'hover:border-brand focus-visible:border-brand',
                  account.status === 'disabled' && 'opacity-60',
                )}
              >
                <Avatar>{initials(account.firstName, account.lastName)}</Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold text-ink">
                      {account.firstName} {account.lastName}
                    </span>
                    {account.id === user.id ? <Badge tone="brand">Vous</Badge> : null}
                  </div>
                  <div className="truncate text-[12.5px] text-muted">{account.email}</div>
                </div>

                <div className="hidden text-[12.5px] text-muted sm:block">{scopeOf(account)}</div>

                <Badge tone={account.status === 'disabled' ? 'neutral' : 'brand'}>
                  {ROLE_LABELS[account.role]}
                </Badge>

                {account.status === 'disabled' ? <Badge tone="danger">Désactivé</Badge> : null}
              </Card>
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
      aria-pressed={active}
      className={cx(
        'cursor-pointer rounded-full border px-3.5 py-2 text-[12.5px] font-semibold',
        active
          ? 'border-brand bg-brand-50 text-brand-dark'
          : 'border-line text-muted hover:border-brand hover:text-brand',
      )}
    >
      {children}
    </button>
  )
}

export default UsersPage
