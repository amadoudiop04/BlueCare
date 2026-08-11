import { useState } from 'react'

import PasswordInput from '@/components/ui/PasswordInput.jsx'
import {
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  Field,
} from '@/components/ui/primitives.jsx'
import { updateProfile } from '@/api/auth.api.js'
import { useAuth } from '@/hooks/useAuth.js'
import { inputClass } from '@/lib/ui.js'

/**
 * Modification de ses propres informations.
 *
 * Ce que l'écran ne propose pas est aussi important que ce qu'il propose : ni
 * le rôle, ni les groupes, ni les enfants rattaches. Ces trois champs decident
 * de ce que l'on voit, et personne n'elargit son propre périmètre — ils
 * restent dans « Comptes », côté direction.
 *
 * Le mot de passe n'est demandé que si l'adresse e-mail change : c'est elle
 * qui recoit les liens de réinitialisation. Le serveur applique la même règle
 * (`auth.service.js`), ce formulaire ne fait que l'annoncer a l'avance.
 */

const FIELDS = ['firstName', 'lastName', 'email', 'phone']

const formOf = (user) => ({
  firstName: user.firstName ?? '',
  lastName: user.lastName ?? '',
  email: user.email ?? '',
  phone: user.phone ?? '',
})

function ProfileInfoCard() {
  const { user, refresh } = useAuth()

  const [form, setForm] = useState(() => formOf(user))
  const [password, setPassword] = useState('')
  const [state, setState] = useState({ error: null, saving: false, done: false })

  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }))
    setState((current) => (current.done ? { ...current, done: false } : current))
  }

  const emailChanged = form.email.trim().toLowerCase() !== (user.email ?? '')
  const dirty = FIELDS.some((field) => form[field].trim() !== (user[field] ?? ''))

  const errorFor = (field) => state.error?.details?.[field]?.[0]

  const reset = () => {
    setForm(formOf(user))
    setPassword('')
    setState({ error: null, saving: false, done: false })
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setState({ error: null, saving: true, done: false })

    try {
      await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        // Vide volontairement : le serveur distingue « absent » de « efface ».
        phone: form.phone.trim(),
        ...(emailChanged ? { currentPassword: password } : {}),
      })

      // Le formulaire se recharge depuis la réponse du serveur, jamais depuis
      // ce qui vient d'être saisi : ce qui compte est ce qui a été enregistre.
      setForm(formOf(await refresh()))
      setPassword('')
      setState({ error: null, saving: false, done: true })
    } catch (error) {
      setState({ error, saving: false, done: false })
    }
  }

  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-4"
        title="Mes informations"
        subtitle="Identité et coordonnées de contact"
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Prenom" error={errorFor('firstName')}>
            <input
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) => set({ firstName: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Nom" error={errorFor('lastName')}>
            <input
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={(event) => set({ lastName: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label="Adresse e-mail"
          hint="Elle sert a se connecter et recoit les liens de réinitialisation"
          error={errorFor('email')}
        >
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(event) => set({ email: event.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="Téléphone (optionnel)" error={errorFor('phone')}>
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => set({ phone: event.target.value })}
            placeholder="+226 70 00 00 00"
            className={inputClass}
          />
        </Field>

        {emailChanged ? (
          <div className="flex flex-col gap-3 rounded-xl border border-warn/30 bg-warn-bg px-3.5 py-3">
            <p className="text-[12.5px] leading-relaxed text-warn-ink">
              Vous changez l'adresse de connexion du compte. Confirmez avec votre mot de passe :
              la prochaine connexion se fera avec <strong>{form.email.trim()}</strong>.
            </p>
            <Field label="Mot de passe actuel" error={errorFor('currentPassword')}>
              <PasswordInput
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {state.error && !state.error.details ? <ErrorNotice error={state.error} /> : null}

        {state.done ? (
          <div className="rounded-[10px] bg-success-bg px-3.5 py-3 text-[12.5px] font-semibold text-success">
            Informations mises a jour.
          </div>
        ) : null}

        <div className="flex items-center gap-2.5">
          <Button type="submit" disabled={state.saving || !dirty}>
            {state.saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {dirty ? (
            <Button variant="secondary" onClick={reset} disabled={state.saving}>
              Annuler
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  )
}

export default ProfileInfoCard
