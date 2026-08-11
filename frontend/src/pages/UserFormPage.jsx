import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import PasswordInput from '@/components/ui/PasswordInput.jsx'
import {
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  Field,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { fetchChildren } from '@/api/children.api.js'
import { fetchReference } from '@/api/tracking.api.js'
import { createUser } from '@/api/users.api.js'
import { useApi } from '@/hooks/useApi.js'
import { ROLE_LABELS } from '@/lib/roles.js'
import { cx, inputClass } from '@/lib/ui.js'

/**
 * Creation d'un compte, reservee a la direction.
 *
 * Le formulaire suit le role choisi, parce que le perimetre n'a pas le meme
 * sens partout (`services/user.service.js`, `readScope`) :
 *   - educateur : une liste de groupes, sinon il ne voit aucun enfant ;
 *   - famille   : au moins un enfant nomme, exige par le serveur ;
 *   - infirmiere, directeur, administrateur : tout le centre, donc rien a saisir.
 *
 * Afficher les trois cas en permanence laisserait croire qu'un directeur se
 * restreint a un groupe, ce qui est faux.
 */

/** Roles proposes, dans l'ordre du plus courant au plus sensible. */
const ROLE_ORDER = ['educator', 'nurse', 'family', 'director', 'admin']

const SCOPE_HINTS = {
  nurse: 'Une infirmière accède aux dossiers de tous les enfants du centre.',
  director: 'Un directeur accède à tout le centre, y compris aux données médicales.',
  admin: 'Un administrateur accède à tout, sans restriction de groupe.',
}

function UserFormPage() {
  const navigate = useNavigate()
  const { data: reference, loading } = useApi(fetchReference, [])

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'educator',
    password: '',
  })
  const [groups, setGroups] = useState([])
  const [childIds, setChildIds] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)

  /*
   * La liste des enfants ne sert qu'au role famille : la charger seulement
   * dans ce cas evite une requete inutile sur le cas courant. `role` est dans
   * les dependances, donc le passage a « famille » declenche le chargement.
   */
  const { data: childList, loading: loadingChildren } = useApi(
    () => (form.role === 'family' ? fetchChildren({ pageSize: 100 }) : Promise.resolve(null)),
    [form.role],
  )

  const minLength = reference?.passwordPolicy?.minLength ?? 10
  const errorFor = (field) => fieldErrors?.[field]?.[0]

  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  const toggle = (list, value) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setFieldErrors(null)
    setSubmitting(true)

    try {
      const account = await createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
        password: form.password,
        // Le telephone vide serait lu comme une valeur fournie et invalide.
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.role === 'educator' ? { groups } : {}),
        ...(form.role === 'family' ? { childIds } : {}),
      })

      navigate('/', {
        state: {
          notice: `Compte créé pour ${account.firstName} ${account.lastName} (${ROLE_LABELS[account.role]}).`,
        },
      })
    } catch (requestError) {
      setError(requestError)
      setFieldErrors(requestError.details ?? null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader crumb="Gestion des comptes" title="Nouveau compte" />
        <PageBody>
          <Skeleton height={460} className="rounded-2xl" />
        </PageBody>
      </>
    )
  }

  return (
    <>
      <PageHeader crumb="Gestion des comptes" title="Nouveau compte" />

      <PageBody>
        <ErrorNotice error={error} />

        <form onSubmit={onSubmit} className="flex flex-col gap-[18px]">
          <Card className="px-6 py-[22px]">
            <CardHeader className="mb-4" title="Identité" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" error={errorFor('firstName')}>
                <input
                  required
                  value={form.firstName}
                  onChange={(event) => set({ firstName: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Nom" error={errorFor('lastName')}>
                <input
                  required
                  value={form.lastName}
                  onChange={(event) => set({ lastName: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Adresse e-mail" error={errorFor('email')}>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={form.email}
                  onChange={(event) => set({ email: event.target.value })}
                  placeholder="vous@exemple.fr"
                  className={inputClass}
                />
              </Field>

              <Field label="Téléphone (optionnel)" error={errorFor('phone')}>
                <input
                  value={form.phone}
                  onChange={(event) => set({ phone: event.target.value })}
                  placeholder="+226 70 00 00 00"
                  className={inputClass}
                />
              </Field>
            </div>
          </Card>

          <Card className="px-6 py-[22px]">
            <CardHeader
              className="mb-4"
              title="Rôle et périmètre"
              subtitle="Le rôle décide des écrans ouverts, le périmètre des enfants concernés"
            />

            <div className="flex flex-col gap-4">
              <Field label="Rôle" error={errorFor('role')}>
                <select
                  value={form.role}
                  onChange={(event) => {
                    set({ role: event.target.value })
                    // Un perimetre saisi pour un role ne veut rien dire pour un
                    // autre : on repart de zero plutot que d'envoyer au serveur
                    // des groupes attaches a une famille.
                    setGroups([])
                    setChildIds([])
                  }}
                  className={inputClass}
                >
                  {ROLE_ORDER.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </Field>

              {form.role === 'educator' ? (
                <Field
                  label="Groupes suivis"
                  hint="Sans groupe, l'éducateur ne verra aucun enfant."
                  error={errorFor('groups')}
                >
                  {reference.groups.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {reference.groups.map((group) => (
                        <button
                          key={group}
                          type="button"
                          onClick={() => setGroups((current) => toggle(current, group))}
                          aria-pressed={groups.includes(group)}
                          className={cx(
                            'cursor-pointer rounded-full border px-3.5 py-2 text-[12.5px] font-semibold',
                            groups.includes(group)
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
                      Aucun groupe n'existe encore : créez d'abord une fiche enfant.
                    </div>
                  )}
                </Field>
              ) : null}

              {form.role === 'family' ? (
                <Field
                  label="Enfants rattachés"
                  hint="Au moins un enfant est exigé. Le compte est en lecture seule."
                  error={errorFor('childIds')}
                >
                  {loadingChildren ? (
                    <Skeleton height={92} className="rounded-xl" />
                  ) : childList?.items?.length > 0 ? (
                    <div className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-xl border border-line-soft p-2">
                      {childList.items.map((child) => (
                        <label
                          key={child.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-canvas"
                        >
                          <input
                            type="checkbox"
                            checked={childIds.includes(child.id)}
                            onChange={() => setChildIds((current) => toggle(current, child.id))}
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
                    <div className="rounded-xl border border-dashed border-line px-4 py-3 text-[12.5px] text-muted">
                      Aucune fiche enfant : créez-en une avant de rattacher une famille.
                    </div>
                  )}
                </Field>
              ) : null}

              {SCOPE_HINTS[form.role] ? (
                <div className="rounded-xl border border-line-soft bg-canvas px-4 py-3 text-[12.5px] text-muted">
                  {SCOPE_HINTS[form.role]}
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="px-6 py-[22px]">
            <CardHeader
              className="mb-4"
              title="Mot de passe initial"
              subtitle="À transmettre à la personne, qui pourra le changer depuis « Mon profil »"
            />

            <Field
              label="Mot de passe"
              hint={`${minLength} caractères minimum, sans espace au début ni à la fin.`}
              error={errorFor('password')}
            >
              <PasswordInput
                required
                autoComplete="new-password"
                minLength={minLength}
                value={form.password}
                onChange={(event) => set({ password: event.target.value })}
                placeholder="Mot de passe initial"
              />
            </Field>
          </Card>

          <div className="flex items-center gap-2.5">
            <Button type="submit" disabled={submitting} className="px-[22px] py-3.5 text-[13.5px]">
              {submitting ? 'Création…' : 'Créer le compte'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')} disabled={submitting}>
              Annuler
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  )
}

export default UserFormPage
