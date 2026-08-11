import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import PasswordInput from '@/components/ui/PasswordInput.jsx'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  Field,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { fetchChildren } from '@/api/children.api.js'
import { fetchReference } from '@/api/tracking.api.js'
import { fetchUser, resetUserMfa, resetUserPassword, updateUser } from '@/api/users.api.js'
import { useApi } from '@/hooks/useApi.js'
import { useAuth } from '@/hooks/useAuth.js'
import { ROLE_LABELS } from '@/lib/roles.js'
import { cx, inputClass } from '@/lib/ui.js'

/**
 * Modification d'un compte, reservee a la direction.
 *
 * Trois operations distinctes, volontairement separees en trois formulaires :
 * corriger une fiche, imposer un mot de passe et retirer le second facteur
 * n'ont ni les memes consequences ni la meme frequence. Les reunir sous un seul
 * bouton « Enregistrer » ferait retaper un mot de passe pour corriger un nom.
 */

const ROLE_ORDER = ['educator', 'nurse', 'family', 'director', 'admin']

const loadContext = async (userId) => {
  const [account, reference] = await Promise.all([fetchUser(userId), fetchReference()])
  return { account, reference }
}

/** Etat du formulaire tel qu'il sort du serveur, avant toute saisie. */
const draftFrom = (account) => ({
  form: {
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone ?? '',
    role: account.role,
    status: account.status,
  },
  groups: account.groups ?? [],
  childIds: account.childIds ?? [],
})

function UserEditPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const { data, error, loading, reload } = useApi(() => loadContext(userId), [userId])

  /*
   * La saisie en cours est gardee avec la version de fiche dont elle est
   * partie. Deduire l'etat au rendu plutot que le poser dans un effet evite le
   * rendu en cascade que `useApi` decrit deja, et fait repartir le formulaire
   * de la version du serveur apres chaque enregistrement.
   */
  const [draft, setDraft] = useState(null)

  const account = data?.account
  const draftKey = account ? `${account.id}#${account.updatedAt}` : null
  const state = draft?.key === draftKey ? draft.value : account ? draftFrom(account) : null

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)
  const [notice, setNotice] = useState(null)

  const [password, setPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [mfaBusy, setMfaBusy] = useState(false)

  // La liste des enfants ne sert qu'aux comptes famille : le role est dans les
  // dependances, donc basculer vers « famille » declenche le chargement.
  const role = state?.form.role
  const { data: childList } = useApi(
    () => (role === 'family' ? fetchChildren({ pageSize: 100 }) : Promise.resolve(null)),
    [role],
  )
  const children = childList?.items ?? []

  const isSelf = account?.id === currentUser.id
  const minLength = data?.reference?.passwordPolicy?.minLength ?? 10
  const errorFor = (field) => fieldErrors?.[field]?.[0]

  const patch = (changes) => setDraft({ key: draftKey, value: { ...state, ...changes } })
  const setForm = (changes) => patch({ form: { ...state.form, ...changes } })
  const toggle = (list, value) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]

  const onSubmit = async (event) => {
    event.preventDefault()
    setSaveError(null)
    setFieldErrors(null)
    setNotice(null)
    setSaving(true)

    try {
      await updateUser(userId, {
        firstName: state.form.firstName,
        lastName: state.form.lastName,
        email: state.form.email,
        role: state.form.role,
        status: state.form.status,
        // Vider le champ doit effacer le telephone, pas le laisser tel quel.
        phone: state.form.phone,
        ...(state.form.role === 'educator' ? { groups: state.groups } : {}),
        ...(state.form.role === 'family' ? { childIds: state.childIds } : {}),
      })

      setNotice('Modifications enregistrées.')
      // Le rechargement change `updatedAt`, donc la cle : le formulaire repart
      // de la version enregistree.
      reload()
    } catch (requestError) {
      setSaveError(requestError)
      setFieldErrors(requestError.details ?? null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const onResetPassword = async () => {
    setSaveError(null)
    setNotice(null)
    setPasswordBusy(true)

    try {
      await resetUserPassword(userId, password)
      setPassword('')
      setNotice('Mot de passe remplacé. Transmettez-le à la personne concernée.')
    } catch (requestError) {
      setSaveError(requestError)
    } finally {
      setPasswordBusy(false)
    }
  }

  const onResetMfa = async () => {
    setSaveError(null)
    setNotice(null)
    setMfaBusy(true)

    try {
      await resetUserMfa(userId)
      setNotice(
        'Double authentification retirée. La personne la reconfigurera à sa prochaine connexion.',
      )
      reload()
    } catch (requestError) {
      setSaveError(requestError)
    } finally {
      setMfaBusy(false)
    }
  }

  if (loading || !state) {
    return (
      <>
        <PageHeader crumb="Gestion des comptes" title="Compte" />
        <PageBody>
          <ErrorNotice error={error} onRetry={reload} />
          {error ? null : <Skeleton height={420} className="rounded-2xl" />}
        </PageBody>
      </>
    )
  }

  return (
    <>
      <PageHeader
        crumb="Gestion des comptes"
        title={`${account.firstName} ${account.lastName}`}
        action={
          <Button variant="secondary" onClick={() => navigate('/comptes')}>
            Retour aux comptes
          </Button>
        }
      />

      <PageBody>
        <ErrorNotice error={saveError} />

        {notice ? (
          <div className="rounded-xl border border-success/25 bg-success-bg px-4 py-3 text-[13px] font-semibold text-success">
            {notice}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-[18px]">
          <Card className="px-6 py-[22px]">
            <CardHeader className="mb-4" title="Identité" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" error={errorFor('firstName')}>
                <input
                  required
                  value={state.form.firstName}
                  onChange={(event) => setForm({ firstName: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Nom" error={errorFor('lastName')}>
                <input
                  required
                  value={state.form.lastName}
                  onChange={(event) => setForm({ lastName: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Adresse e-mail" error={errorFor('email')}>
                <input
                  type="email"
                  required
                  value={state.form.email}
                  onChange={(event) => setForm({ email: event.target.value })}
                  placeholder="vous@exemple.fr"
                  className={inputClass}
                />
              </Field>

              <Field label="Téléphone (optionnel)" error={errorFor('phone')}>
                <input
                  value={state.form.phone}
                  onChange={(event) => setForm({ phone: event.target.value })}
                  placeholder="+226 70 00 00 00"
                  className={inputClass}
                />
              </Field>
            </div>
          </Card>

          <Card className="px-6 py-[22px]">
            <CardHeader
              className="mb-4"
              title="Rôle, périmètre et accès"
              subtitle="Le rôle décide des écrans ouverts, le périmètre des enfants concernés"
            />

            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Rôle" error={errorFor('role')}>
                  <select
                    value={state.form.role}
                    onChange={(event) =>
                      // Un perimetre n'a pas le meme sens d'un role a l'autre :
                      // on repart de zero plutot que de l'emporter tel quel.
                      patch({
                        form: { ...state.form, role: event.target.value },
                        groups: [],
                        childIds: [],
                      })
                    }
                    className={inputClass}
                  >
                    {ROLE_ORDER.map((entry) => (
                      <option key={entry} value={entry}>
                        {ROLE_LABELS[entry]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Accès"
                  hint={
                    isSelf
                      ? 'Vous ne pouvez pas désactiver votre propre compte.'
                      : 'Un compte désactivé ne peut plus se connecter, mais garde ses comptes-rendus.'
                  }
                  error={errorFor('status')}
                >
                  <select
                    value={state.form.status}
                    disabled={isSelf}
                    onChange={(event) => setForm({ status: event.target.value })}
                    className={cx(inputClass, isSelf && 'cursor-not-allowed opacity-60')}
                  >
                    <option value="active">Actif</option>
                    <option value="disabled">Désactivé</option>
                  </select>
                </Field>
              </div>

              {state.form.role === 'educator' ? (
                <Field
                  label="Groupes suivis"
                  hint="Sans groupe, l'éducateur ne verra aucun enfant."
                  error={errorFor('groups')}
                >
                  {data.reference.groups.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.reference.groups.map((group) => (
                        <button
                          key={group}
                          type="button"
                          onClick={() => patch({ groups: toggle(state.groups, group) })}
                          aria-pressed={state.groups.includes(group)}
                          className={cx(
                            'cursor-pointer rounded-full border px-3.5 py-2 text-[12.5px] font-semibold',
                            state.groups.includes(group)
                              ? 'border-brand bg-brand-50 text-brand-dark'
                              : 'border-line text-muted hover:border-brand hover:text-brand',
                          )}
                        >
                          {group}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line px-4 py-3 text-[12.5px] text-muted">
                      Aucun groupe n'existe encore.
                    </div>
                  )}
                </Field>
              ) : null}

              {state.form.role === 'family' ? (
                <Field
                  label="Enfants rattachés"
                  hint="Au moins un enfant est exigé. Le compte est en lecture seule."
                  error={errorFor('childIds')}
                >
                  {children.length > 0 ? (
                    <div className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-xl border border-line-soft p-2">
                      {children.map((child) => (
                        <label
                          key={child.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-canvas"
                        >
                          <input
                            type="checkbox"
                            checked={state.childIds.includes(child.id)}
                            onChange={() => patch({ childIds: toggle(state.childIds, child.id) })}
                            className="h-4 w-4 accent-brand"
                          />
                          <span className="font-medium text-ink">
                            {child.firstName} {child.lastName}
                          </span>
                          {child.group ? (
                            <span className="text-[11.5px] text-muted">{child.group}</span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Skeleton height={92} className="rounded-xl" />
                  )}
                </Field>
              ) : null}
            </div>
          </Card>

          <div className="flex items-center gap-2.5">
            <Button type="submit" disabled={saving} className="px-[22px] py-3.5 text-[13.5px]">
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/comptes')} disabled={saving}>
              Annuler
            </Button>
          </div>
        </form>

        <Card className="px-6 py-[22px]">
          <CardHeader
            className="mb-4"
            title="Mot de passe"
            subtitle="Procédure du compte perdu : l'ancien mot de passe n'est pas demandé"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Nouveau mot de passe" hint={`${minLength} caractères minimum.`}>
                <PasswordInput
                  autoComplete="new-password"
                  minLength={minLength}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nouveau mot de passe"
                />
              </Field>
            </div>

            <Button
              variant="secondary"
              onClick={onResetPassword}
              disabled={passwordBusy || password.length < minLength}
              className="py-3.5"
            >
              {passwordBusy ? 'Remplacement…' : 'Remplacer'}
            </Button>
          </div>
        </Card>

        <Card className="px-6 py-[22px]">
          <CardHeader
            className="mb-4"
            title="Double authentification"
            subtitle="À utiliser quand la personne a perdu son téléphone"
            action={
              <Badge tone={account.mfaEnabled ? 'success' : 'neutral'}>
                {account.mfaEnabled ? 'Activée' : 'Non activée'}
              </Badge>
            }
          />

          <div className="flex items-center justify-between gap-4">
            <div className="text-[12.5px] text-muted">
              Retirer le second facteur laisse la personne se reconnecter avec son seul mot de
              passe, puis le reconfigurer depuis « Mon profil ».
            </div>

            <Button
              variant="danger"
              onClick={onResetMfa}
              disabled={mfaBusy || !account.mfaEnabled}
              className="flex-none"
            >
              {mfaBusy ? 'Retrait…' : 'Retirer'}
            </Button>
          </div>
        </Card>
      </PageBody>
    </>
  )
}

export default UserEditPage
