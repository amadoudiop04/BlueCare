import { Suspense, lazy, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import ButterflyMark from '@/components/ui/ButterflyMark.jsx'
import { Button, Field } from '@/components/ui/primitives.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { homePathFor } from '@/lib/navigation.js'
import { inputClass } from '@/lib/ui.js'

/*
 * L'effet ASCII embarque three.js (~600 Ko), pour une decoration presente sur
 * ce seul ecran. Le charger a la demande evite de le faire porter a toute
 * l'application, qui n'en a jamais besoin une fois connecte.
 */
const AsciiButterfly = lazy(() => import('@/components/ui/AsciiButterfly.jsx'))

const STATS = [
  { value: '42', label: 'enfants accompagnes' },
  { value: '3', label: 'groupes educatifs' },
  { value: 'AES-256', label: 'donnees chiffrees' },
]

function LoginPage() {
  const { login, isAuthenticated, user, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated' && isAuthenticated) {
    return <Navigate to={location.state?.from ?? homePathFor(user.role)} replace />
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const account = await login({ email, password })
      navigate(location.state?.from ?? homePathFor(account.role), { replace: true })
    } catch (requestError) {
      // Le serveur renvoie le meme message pour un e-mail inconnu et un mot de
      // passe faux : on le reprend tel quel plutot que d'en deduire davantage.
      setError(requestError.message || 'Connexion impossible')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <div className="hidden flex-col bg-gradient-to-br from-[#0C1E42] via-[#14418F] to-[#1E5FD8] px-14 py-[54px] text-white lg:flex">
        <div className="flex items-center gap-3">
          <ButterflyMark size={42} radius={12} background="rgba(255,255,255,0.14)" />
          <div className="flex flex-col gap-0.5">
            <div className="text-base font-bold tracking-[-0.01em]">BlueCare</div>
            <div className="text-[11px] font-medium text-onnavy-bright">Centre Papillon Bleu</div>
          </div>
        </div>

        <div className="relative my-[22px] h-[248px]">
          <Suspense fallback={null}>
            <AsciiButterfly fontSize={7} planeHeight={15} />
          </Suspense>
        </div>

        <div className="mt-auto max-w-[440px] animate-up">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-onnavy-bright">
            Outil interne securise
          </div>
          <div className="mb-4 text-[34px] font-bold leading-[1.15] tracking-[-0.03em] text-pretty">
            Le suivi pedagogique de chaque enfant, au meme endroit.
          </div>
          <div className="text-[14.5px] leading-[1.65] text-onnavy-pale">
            Fiches individuelles, comptes-rendus de seance, objectifs et presences — accessibles
            selon votre role et journalises.
          </div>
        </div>

        <div className="mt-10 flex gap-[34px] border-t border-white/[0.13] pt-[26px]">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-[21px] font-bold tracking-[-0.02em]">{stat.value}</div>
              <div className="mt-[3px] text-[11.5px] text-onnavy-bright">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-10">
        <form onSubmit={onSubmit} className="w-full max-w-[372px] animate-up">
          <div className="mb-2 flex items-center gap-3 lg:hidden">
            <ButterflyMark size={38} radius={11} />
            <span className="text-base font-bold">BlueCare</span>
          </div>

          <div className="mb-[7px] text-2xl font-bold tracking-[-0.02em]">Connexion</div>
          <div className="mb-7 text-[13.5px] text-muted">
            Utilisez votre compte professionnel du centre.
          </div>

          <div className="flex flex-col gap-4">
            <Field label="Adresse e-mail">
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="prenom.nom@papillonbleu.test"
                className={inputClass}
              />
            </Field>

            <Field label="Mot de passe">
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </Field>

            {error ? (
              <div
                role="alert"
                className="rounded-[10px] border border-danger/25 bg-danger-bg px-3.5 py-3 text-[12.5px] font-semibold text-danger"
              >
                {error}
              </div>
            ) : null}

            <Button type="submit" disabled={submitting} className="mt-1 py-3.5 text-sm">
              {submitting ? 'Connexion…' : 'Se connecter'}
            </Button>

            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted">Mot de passe oublie ? Contactez la direction.</span>
              <span className="text-muted-light">Acces famille par lien securise</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
