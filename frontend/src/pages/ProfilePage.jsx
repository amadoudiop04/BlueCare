import { useState } from 'react'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  Field,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import PasswordInput from '@/components/ui/PasswordInput.jsx'
import AccountDangerZone from '@/features/auth/AccountDangerZone.jsx'
import MfaCard from '@/features/auth/MfaCard.jsx'
import ProfileInfoCard from '@/features/auth/ProfileInfoCard.jsx'
import SessionsCard from '@/features/auth/SessionsCard.jsx'
import { changePassword } from '@/api/auth.api.js'
import { fetchNotifications } from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { useAuth } from '@/hooks/useAuth.js'
import { formatDate, initials } from '@/lib/format.js'
import { permissionsFor, roleLabel } from '@/lib/roles.js'
import { cx } from '@/lib/ui.js'

/**
 * Profil de l'utilisateur connecte.
 *
 * Les droits affichés sont deduits de la matrice appliquee par le serveur
 * (`lib/roles.js`) : l'écran ne peut donc pas promettre un accès que l API
 * refuserait. Les blocs de la maquette sans equivalent côté backend
 * (terminaux connectes, preferences de notification persistees) ne sont pas
 * repris plutôt que d'être simules.
 */
function ProfilePage() {
  const { user, scope } = useAuth()
  const notifications = useApi(() => fetchNotifications().catch(() => ({ items: [], summary: null })), [])

  const permissions = permissionsFor(user.role)

  // Ce que l'utilisateur ne peut pas changer lui-même : son rôle et son
  // périmètre viennent de la direction, les dates du serveur. Le reste
  // (identité, adresse e-mail, téléphone) se modifie dans `ProfileInfoCard`.
  const infos = [
    { key: 'Fonction', value: roleLabel(user.role) },
    {
      key: user.role === 'family' ? 'Enfants rattaches' : 'Groupes assignes',
      value:
        user.role === 'family'
          ? `${user.childIds?.length ?? 0} enfant(s)`
          : (user.groups?.length ? user.groups.join(' · ') : 'Tout le centre'),
    },
    { key: 'Périmètre', value: `${scope?.childCount ?? '—'} enfant(s) accessibles` },
    { key: 'Compte crée le', value: formatDate(user.createdAt) },
    {
      key: 'Dernière connexion',
      value: user.lastLoginAt ? formatDate(user.lastLoginAt.slice(0, 10)) : 'Première session',
    },
  ]

  return (
    <>
      <PageHeader crumb="Compte utilisateur" title="Mon profil" />

      <PageBody>
        {/*
         * Bandeau d'identite : on doit voir de qui est le compte ouvert avant
         * de toucher aux formulaires en dessous. Sur les postes partages du
         * centre, c'est aussi le rappel qu'on n'est pas dans la session d'un
         * collègue. La déconnexion, elle, reste en bas de la barre laterale,
         * atteignable depuis n'importe quel écran plutôt que d'ici seulement.
         *
         * Les initiales tiennent lieu de photo : l'application n'en stocke
         * aucune, et un enfant du centre n'a rien a faire dans un avatar.
         */}
        <Card className="mb-[18px] flex items-center gap-4 px-6 py-5 sm:gap-5">
          <span
            className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-full bg-canvas text-[19px] font-bold tracking-[0.02em] text-muted-strong sm:h-[68px] sm:w-[68px] sm:text-[21px]"
            aria-hidden="true"
          >
            {initials(user.firstName, user.lastName)}
          </span>

          <div className="min-w-0">
            <h2 className="truncate text-[19px] font-bold tracking-[-0.015em] text-ink sm:text-[22px]">
              {user.firstName} {user.lastName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Badge tone="brand">{roleLabel(user.role)}</Badge>
              <span className="min-w-0 truncate text-[12.5px] text-muted">{user.email}</span>
            </div>
          </div>
        </Card>

        <div className="grid items-start gap-[18px] xl:grid-cols-2">
          <div className="flex flex-col gap-[18px]">
            <ProfileInfoCard />

            <Card className="px-6 py-[22px]">
              <CardHeader
                className="mb-4"
                title="Rôle et périmètre"
                subtitle="Definis par la direction · non modifiables ici"
              />
              {infos.map((info) => (
                <div
                  key={info.key}
                  className="flex justify-between gap-4 border-b border-canvas py-3 text-[13px]"
                >
                  <span className="font-medium text-muted">{info.key}</span>
                  <span className="text-right font-semibold text-ink">{info.value}</span>
                </div>
              ))}
            </Card>

            <Card className="px-6 py-[22px]">
              <CardHeader
                className="mb-4"
                title="Droits d'accès"
                subtitle="Définis par votre rôle · appliques par le serveur"
              />
              <div className="flex flex-col gap-2.5">
                {permissions.map((permission) => (
                  <div
                    key={permission.label}
                    className="flex items-center gap-3 rounded-[11px] border border-line-soft px-3.5 py-3"
                  >
                    <span
                      className={cx(
                        'h-[9px] w-[9px] flex-none rounded-[3px]',
                        permission.granted ? 'bg-success' : 'bg-line-strong',
                      )}
                    />
                    <span className="flex-1 text-[13px] font-semibold text-ink">
                      {permission.label}
                    </span>
                    <Badge tone={permission.granted ? 'success' : 'neutral'}>{permission.value}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-[18px]">
            <MfaCard />
            <PasswordCard />
            <SessionsCard />
            <AccountDangerZone />

            <Card className="px-6 py-[22px]">
              <CardHeader
                className="mb-4"
                title="Activité récente"
                subtitle="Ce qui demande votre attention aujourd'hui"
              />

              {notifications.loading ? (
                <Skeleton height={120} />
              ) : notifications.data.items.length === 0 ? (
                <div className="text-[12.5px] text-muted">Rien a signaler.</div>
              ) : (
                <div className="flex flex-col">
                  {notifications.data.items.slice(0, 6).map((item, index, list) => (
                    <div key={item.id} className="flex gap-3.5">
                      <div className="flex flex-none flex-col items-center">
                        <span
                          className="mt-1 h-[9px] w-[9px] rounded-full"
                          style={{
                            background:
                              item.severity === 'critical'
                                ? '#C0405A'
                                : item.severity === 'warning'
                                  ? '#C77A0A'
                                  : '#1E5FD8',
                          }}
                        />
                        {index < list.length - 1 ? <span className="w-px flex-1 bg-line-soft" /> : null}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="text-[13px] font-semibold text-ink">{item.title}</div>
                        <div className="mt-0.5 font-mono text-[11.5px] text-muted-light">
                          {item.occurredAt}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  )
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [state, setState] = useState({ error: null, done: false, saving: false })

  const onSubmit = async (event) => {
    event.preventDefault()
    setState({ error: null, done: false, saving: true })

    try {
      await changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setState({ error: null, done: true, saving: false })
    } catch (error) {
      setState({ error, done: false, saving: false })
    }
  }

  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-4"
        title="Sécurité"
        subtitle="10 caractères minimum"
        action={<Badge tone="success">SESSION 24 H</Badge>}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Mot de passe actuel">
          <PasswordInput
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </Field>

        <Field
          label="Nouveau mot de passe"
          hint={`${newPassword.length} / 10 caractères minimum`}
          error={state.error?.details?.newPassword?.[0]}
        >
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={10}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </Field>

        {state.error && !state.error.details ? <ErrorNotice error={state.error} /> : null}

        {state.done ? (
          <div className="rounded-[10px] bg-success-bg px-3.5 py-3 text-[12.5px] font-semibold text-success">
            Mot de passe mis à jour.
          </div>
        ) : null}

        <Button type="submit" disabled={state.saving} className="self-start">
          {state.saving ? 'Enregistrement…' : 'Changer le mot de passe'}
        </Button>
      </form>
    </Card>
  )
}

export default ProfilePage
