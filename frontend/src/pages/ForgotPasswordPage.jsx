import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button, Field } from '@/components/ui/primitives.jsx'
import AuthShell, { AuthError } from '@/features/auth/AuthShell.jsx'
import { apiClient } from '@/api/client.js'
import { inputClass } from '@/lib/ui.js'

/**
 * Demande de reinitialisation.
 *
 * L ecran de confirmation ne dit pas si l adresse existe : sinon ce formulaire
 * deviendrait un moyen de decouvrir qui travaille au centre. Le message est
 * donc volontairement au conditionnel, et identique dans les deux cas.
 */
function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()

    setError(null)
    setSubmitting(true)

    try {
      await apiClient.post('/auth/password/forgot', { email })
      setSent(true)
    } catch (requestError) {
      setError(requestError.message || 'Demande impossible')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Verifiez votre messagerie"
        subtitle={
          `Si un compte est associe a ${email}, un lien de reinitialisation vient d y etre ` +
          `envoye. Il expire dans l heure et ne fonctionne qu une fois.`
        }
        footer={
          <Link to="/connexion" className="font-semibold text-brand hover:underline">
            Retour a la connexion
          </Link>
        }
      >
        <div className="rounded-[10px] border border-line bg-white px-4 py-3.5 text-[12.5px] leading-[1.6] text-muted">
          Le message n arrive pas ? Regardez dans les indesirables, puis contactez la direction —
          elle peut reinitialiser votre acces depuis la gestion des comptes.
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Mot de passe oublie"
      subtitle="Indiquez l adresse de votre compte professionnel : nous vous enverrons un lien pour en choisir un nouveau."
      footer={
        <Link to="/connexion" className="font-semibold text-brand hover:underline">
          Retour a la connexion
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Adresse e-mail">
          <input
            type="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prenom.nom@papillonbleu.test"
            className={inputClass}
          />
        </Field>

        <AuthError>{error}</AuthError>

        <Button type="submit" disabled={submitting} className="mt-1 py-3.5 text-sm">
          {submitting ? 'Envoi…' : 'Envoyer le lien'}
        </Button>
      </form>
    </AuthShell>
  )
}

export default ForgotPasswordPage
