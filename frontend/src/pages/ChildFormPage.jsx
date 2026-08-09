import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import {
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  Field,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { createChild } from '@/api/children.api.js'
import { fetchReference } from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { todayIso } from '@/lib/format.js'
import { cx, inputClass } from '@/lib/ui.js'

/**
 * Creation d une fiche enfant.
 *
 * Les listes de valeurs (types de handicap, relations, groupes existants)
 * viennent de `/api/reference` : aucune n'est ecrite en dur ici, elles suivent
 * le vocabulaire du serveur.
 */

const emptyContact = () => ({
  firstName: '',
  lastName: '',
  relationship: 'mother',
  phone: '',
  email: '',
  isPrimary: false,
})

function ChildFormPage() {
  const navigate = useNavigate()
  const { data: reference, loading } = useApi(fetchReference, [])

  const [identity, setIdentity] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
    address: '',
    group: '',
    enrolledAt: todayIso(),
  })
  const [disability, setDisability] = useState({ type: '', details: '', supportPlan: '' })
  const [contacts, setContacts] = useState([{ ...emptyContact(), isPrimary: true }])
  const [doctor, setDoctor] = useState({ lastName: '', specialty: '', phone: '' })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)

  const errorFor = (field) => fieldErrors?.[field]?.[0]

  const setContact = (index, patch) =>
    setContacts((current) =>
      current.map((contact, position) => (position === index ? { ...contact, ...patch } : contact)),
    )

  /** Un seul contact principal : cocher l'un decoche les autres. */
  const setPrimary = (index) =>
    setContacts((current) =>
      current.map((contact, position) => ({ ...contact, isPrimary: position === index })),
    )

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setFieldErrors(null)
    setSubmitting(true)

    // Les champs laisses vides sont omis plutot qu'envoyes en chaine vide :
    // le serveur les traiterait comme une valeur fournie et invalide.
    const clean = (object) =>
      Object.fromEntries(
        Object.entries(object).filter(([, value]) => value !== '' && value !== null),
      )

    try {
      const child = await createChild({
        ...clean(identity),
        disability: clean(disability),
        familyContacts: contacts.map((contact) => clean(contact)),
        ...(doctor.lastName ? { referringDoctor: clean(doctor) } : {}),
      })

      navigate(`/enfants/${child.id}`)
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
        <PageHeader crumb="Gestion des enfants" title="Nouvelle fiche" />
        <PageBody>
          <Skeleton height={520} className="rounded-2xl" />
        </PageBody>
      </>
    )
  }

  return (
    <>
      <PageHeader crumb="Gestion des enfants" title="Nouvelle fiche enfant" />

      <PageBody>
        <ErrorNotice error={error} />

        <form onSubmit={onSubmit} className="flex flex-col gap-[18px]">
          <Card className="px-6 py-[22px]">
            <CardHeader className="mb-4" title="Identite" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prenom" error={errorFor('firstName')}>
                <input
                  required
                  value={identity.firstName}
                  onChange={(event) => setIdentity({ ...identity, firstName: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Nom" error={errorFor('lastName')}>
                <input
                  required
                  value={identity.lastName}
                  onChange={(event) => setIdentity({ ...identity, lastName: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Date de naissance" error={errorFor('birthDate')}>
                <input
                  type="date"
                  required
                  max={todayIso()}
                  value={identity.birthDate}
                  onChange={(event) => setIdentity({ ...identity, birthDate: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Sexe (optionnel)" error={errorFor('gender')}>
                <select
                  value={identity.gender}
                  onChange={(event) => setIdentity({ ...identity, gender: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Non renseigne</option>
                  {reference.genders.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Groupe"
                hint="Choisissez un groupe existant ou saisissez-en un nouveau"
                error={errorFor('group')}
              >
                <input
                  required
                  list="groupes-existants"
                  value={identity.group}
                  onChange={(event) => setIdentity({ ...identity, group: event.target.value })}
                  className={inputClass}
                />
                <datalist id="groupes-existants">
                  {reference.groups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </Field>

              <Field label="Date d entree" error={errorFor('enrolledAt')}>
                <input
                  type="date"
                  max={todayIso()}
                  value={identity.enrolledAt}
                  onChange={(event) => setIdentity({ ...identity, enrolledAt: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Adresse (optionnel)" error={errorFor('address')}>
                  <input
                    value={identity.address}
                    onChange={(event) => setIdentity({ ...identity, address: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="px-6 py-[22px]">
            <CardHeader
              className="mb-4"
              title="Accompagnement"
              subtitle="Visible par l equipe pedagogique"
            />

            <div className="flex flex-col gap-4">
              <Field label="Type de handicap" error={errorFor('disability.type')}>
                <select
                  required
                  value={disability.type}
                  onChange={(event) => setDisability({ ...disability, type: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Choisir…</option>
                  {reference.disabilityTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Precisions (optionnel)" error={errorFor('disability.details')}>
                <textarea
                  rows={2}
                  value={disability.details}
                  onChange={(event) => setDisability({ ...disability, details: event.target.value })}
                  className={cx(inputClass, 'resize-y')}
                />
              </Field>

              <Field
                label="Plan d accompagnement (optionnel)"
                hint="Ce que l equipe doit savoir pour animer les seances"
                error={errorFor('disability.supportPlan')}
              >
                <textarea
                  rows={2}
                  value={disability.supportPlan}
                  onChange={(event) =>
                    setDisability({ ...disability, supportPlan: event.target.value })
                  }
                  className={cx(inputClass, 'resize-y')}
                />
              </Field>
            </div>
          </Card>

          <Card className="px-6 py-[22px]">
            <CardHeader
              className="mb-4"
              title="Contacts famille"
              subtitle="Au moins un contact est requis"
              action={
                <Button
                  variant="soft"
                  onClick={() => setContacts([...contacts, emptyContact()])}
                  className="px-3.5 py-2 text-[12.5px]"
                >
                  + Ajouter
                </Button>
              }
            />

            <div className="flex flex-col gap-4">
              {contacts.map((contact, index) => (
                <div
                  // Les contacts n ont pas encore d identifiant : le serveur
                  // leur en attribue un a la creation.
                  key={index}
                  className="rounded-xl border border-line-soft px-4 py-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-ink">
                      <input
                        type="radio"
                        name="primary-contact"
                        checked={contact.isPrimary}
                        onChange={() => setPrimary(index)}
                        className="h-4 w-4 accent-brand"
                      />
                      Contact principal
                    </label>

                    {contacts.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setContacts(contacts.filter((_, p) => p !== index))}
                        className="cursor-pointer text-[12.5px] font-semibold text-muted hover:text-danger"
                      >
                        Retirer
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nom" error={errorFor(`familyContacts.${index}.lastName`)}>
                      <input
                        required
                        value={contact.lastName}
                        onChange={(event) => setContact(index, { lastName: event.target.value })}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Prenom (optionnel)">
                      <input
                        value={contact.firstName}
                        onChange={(event) => setContact(index, { firstName: event.target.value })}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Lien" error={errorFor(`familyContacts.${index}.relationship`)}>
                      <select
                        value={contact.relationship}
                        onChange={(event) =>
                          setContact(index, { relationship: event.target.value })
                        }
                        className={inputClass}
                      >
                        {reference.contactRelationships.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Telephone" error={errorFor(`familyContacts.${index}.phone`)}>
                      <input
                        required
                        value={contact.phone}
                        onChange={(event) => setContact(index, { phone: event.target.value })}
                        placeholder="+226 70 00 00 00"
                        className={inputClass}
                      />
                    </Field>

                    <div className="sm:col-span-2">
                      <Field
                        label="E-mail (optionnel)"
                        error={errorFor(`familyContacts.${index}.email`)}
                      >
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(event) => setContact(index, { email: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="px-6 py-[22px]">
            <CardHeader
              className="mb-4"
              title="Medecin referent (optionnel)"
              subtitle="Visible par l infirmiere et la direction uniquement"
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nom" error={errorFor('referringDoctor.lastName')}>
                <input
                  value={doctor.lastName}
                  onChange={(event) => setDoctor({ ...doctor, lastName: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Specialite">
                <input
                  value={doctor.specialty}
                  onChange={(event) => setDoctor({ ...doctor, specialty: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Telephone" error={errorFor('referringDoctor.phone')}>
                <input
                  value={doctor.phone}
                  onChange={(event) => setDoctor({ ...doctor, phone: event.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
          </Card>

          <div className="flex items-center gap-2.5">
            <Button type="submit" disabled={submitting} className="px-[22px] py-3.5 text-[13.5px]">
              {submitting ? 'Enregistrement…' : 'Creer la fiche'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/enfants')} disabled={submitting}>
              Annuler
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  )
}

export default ChildFormPage
