import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import OtpInput from '@/components/ui/OtpInput.jsx'
import PasswordInput from '@/components/ui/PasswordInput.jsx'
import { Button, Field, Skeleton } from '@/components/ui/primitives.jsx'
import AuthShell, { AuthError } from '@/features/auth/AuthShell.jsx'
import { apiClient } from '@/api/client.js'
import { inputClass } from '@/lib/ui.js'

/**
 * Choix d'un nouveau mot de passe depuis le lien reçu par courriel.
 *
 * Quand le compte est protégé par un second facteur, le code reste exige ici.
 * C'est le point important de cet écran : sans cela, l'accès'a la boite mail
 * suffirait a prendre le compte, et la double authentification ne protegerait
 * plus de grand-chose.
 */
// Doit rester aligne sur `MIN_PASSWORD_LENGTH` du serveur, qui tranche.
const MIN_LENGTH = 10

function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [state, setState] = useState({ status: 'checking', mfaRequired: false })
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Le lien est vérifie avant d'afficher le formulaire : inutile de faire
  // saisir un mot de passe pour apprendre ensuite que le lien a expire.
  useEffect(() => {
    let active = true

    apiClient
      .get(`/auth/password/reset/${encodeURIComponent(token)}`)
      .then((response) => {
        if (!active) return
        setState({
          status: response.data.valid ? 'ready' : 'invalid',
          mfaRequired: Boolean(response.data.mfaRequired),
        })
      })
      .catch(() => active && setState({ status: 'invalid', mfaRequired: false }))

    return () => {
      active = false
    }
  }, [token])

  const mismatch = confirmation.length > 0 && password !== confirmation
  const tooShort = password.length > 0 && password.length < MIN_LENGTH

  const onSubmit = async (event) => {
    event.preventDefault()

    if (mismatch || tooShort) return

    setError(null)
    setSubmitting(true)

    try {
      await apiClient.post(`/auth/password/reset/${encodeURIComponent(token)}`, {
        password,
        ...(state.mfaRequired ? { code } : {}),
      })

      navigate('/connexion', {
        replace: true,
        state: { notice: 'Mot de passe modifie. Connectez-vous avec le nouveau.' },
      })
    } catch (requestError) {
      setError(requestError.message || 'Réinitialisation impossible')
      setCode('')

      // Lien consommé ou expire pendant la saisie : le formulaire n'a plus lieu d'être.
      if (requestError.status === 400 && /lien/i.test(requestError.message ?? '')) {
        setState((current) => ({ ...current, status: 'invalid' }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (state.status === 'checking') {
    return (
      <AuthShell title="Vérification du lien" subtitle="Un instant, nous validons votre lien.">
        <div className="flex flex-col gap-3">
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      </AuthShell>
    )
  }

  if (state.status === 'invalid') {
    return (
      <AuthShell
        title="Lien expire"
        subtitle="Ce lien n'est plus valable : il a peut-être déjà servi, ou il date de plus d'une heure."
        footer={
          <Link to="/connexion" className="font-semibold text-brand hover:underline">
            Retour a la connexion
          </Link>
        }
      >
        <Link to="/mot-de-passe-oublie" className="block">
          <Button className="w-full py-3.5 text-sm">Demander un nouveau lien</Button>
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle={
        state.mfaRequired
          ? `Choisissez un mot de passe d'au moins ${MIN_LENGTH} caractères, puis confirmez avec votre code de vérification.`
          : `Choisissez un mot de passe d'au moins ${MIN_LENGTH} caractères.`
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="Nouveau mot de passe"
          hint={`${MIN_LENGTH} caractères minimum`}
          error={tooShort ? `Trop court : ${MIN_LENGTH} caracteres minimum` : null}
        >
          <PasswordInput
            autoComplete="new-password"
            autoFocus
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field
          label="Confirmation"
          error={mismatch ? 'Les deux saisies different' : null}
        >
          <PasswordInput
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>

        {state.mfaRequired ? (
          <div>
            <div className="mb-2 text-xs font-bold text-ink">
              {useRecovery ? 'Code de secours' : 'Code de vérification'}
            </div>

            {useRecovery ? (
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="A3F2-9K1D"
                className={`${inputClass} text-center font-mono tracking-widest`}
              />
            ) : (
              <OtpInput
                value={code}
                onChange={setCode}
                disabled={submitting}
                autoFocus={false}
                invalid={Boolean(error)}
              />
            )}

            <button
              type="button"
              onClick={() => {
                setUseRecovery((current) => !current)
                setCode('')
                setError(null)
              }}
              className="mt-2 cursor-pointer text-[12.5px] font-semibold text-brand hover:underline"
            >
              {useRecovery ? 'Utiliser mon application' : 'Utiliser un code de secours'}
            </button>
          </div>
        ) : null}

        <AuthError>{error}</AuthError>

        <Button
          type="submit"
          disabled={submitting || mismatch || tooShort}
          className="mt-1 py-3.5 text-sm"
        >
          {submitting ? 'Enregistrement…' : 'Définir le mot de passe'}
        </Button>

        <div className="text-[12.5px] leading-[1.6] text-muted">
          Toutes vos sessions ouvertes seront fermees, sur tous vos appareils.
        </div>
      </form>
    </AuthShell>
  )
}

export default ResetPasswordPage
