import { useState } from 'react'

import OtpInput from '@/components/ui/OtpInput.jsx'
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
import {
  disableMfa,
  enableMfa,
  fetchMfaStatus,
  startMfaSetup,
} from '@/api/auth.api.js'
import { useApi } from '@/hooks/useApi.js'
import { cx, inputClass } from '@/lib/ui.js'

/**
 * Activation de la double authentification depuis le profil.
 *
 * Trois etats : inactive, enrolement en cours (secret genere, code a
 * confirmer), active. Les codes de secours ne sont affiches qu une fois, juste
 * apres l activation — ensuite le serveur n'en garde que les hachages.
 */
function MfaCard() {
  const { data: status, loading, reload } = useApi(fetchMfaStatus, [])

  const [enrollment, setEnrollment] = useState(null)
  const [recoveryCodes, setRecoveryCodes] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (action) => {
    setError(null)
    setBusy(true)

    try {
      await action()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setBusy(false)
    }
  }

  const begin = () =>
    run(async () => {
      setEnrollment(await startMfaSetup())
      setCode('')
    })

  const confirm = (value = code) =>
    run(async () => {
      const result = await enableMfa(value)
      setRecoveryCodes(result.recoveryCodes)
      setEnrollment(null)
      setCode('')
      reload()
    })

  if (loading) {
    return (
      <Card className="px-6 py-[22px]">
        <Skeleton height={140} />
      </Card>
    )
  }

  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-4"
        title="Double authentification"
        subtitle="Code a usage unique, en plus du mot de passe"
        action={
          <Badge tone={status.enabled ? 'success' : status.required ? 'warn' : 'neutral'}>
            {status.enabled ? 'ACTIVE' : status.required ? 'OBLIGATOIRE' : 'INACTIVE'}
          </Badge>
        }
      />

      <ErrorNotice error={error} />

      {recoveryCodes ? (
        <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />
      ) : status.enabled ? (
        <ActiveState status={status} busy={busy} onDisabled={reload} setError={setError} />
      ) : enrollment ? (
        <EnrollmentState
          enrollment={enrollment}
          code={code}
          setCode={setCode}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setEnrollment(null)}
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          <p className="text-[13px] leading-relaxed text-muted-strong">
            Un code a 6 chiffres, genere par votre telephone, sera demande a chaque connexion.
            Compatible avec Google Authenticator, Authy, 1Password ou FreeOTP.
            {status.required ? ' Votre role l impose : ce compte voit tout le centre.' : ''}
          </p>
          <Button onClick={begin} disabled={busy} className="self-start">
            {busy ? 'Preparation…' : 'Activer'}
          </Button>
        </div>
      )}
    </Card>
  )
}

function EnrollmentState({ enrollment, code, setCode, busy, onConfirm, onCancel }) {
  const [showSecret, setShowSecret] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex list-inside list-decimal flex-col gap-1.5 text-[13px] text-muted-strong">
        <li>Ouvrez votre application d authentification.</li>
        <li>Ajoutez un compte, puis collez le lien ci-dessous (ou saisissez la clef).</li>
        <li>Entrez le code a 6 chiffres qu elle affiche.</li>
      </ol>

      <div className="rounded-xl bg-canvas px-3.5 py-3">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Lien de configuration
        </div>
        <code className="block break-all font-mono text-[11px] leading-relaxed text-ink">
          {enrollment.otpauthUri}
        </code>

        <button
          type="button"
          onClick={() => setShowSecret((current) => !current)}
          className="mt-2.5 cursor-pointer text-[12px] font-semibold text-brand hover:underline"
        >
          {showSecret ? 'Masquer la clef' : 'Saisir la clef manuellement'}
        </button>

        {showSecret ? (
          <code className="mt-2 block break-all rounded-lg border border-line bg-white px-3 py-2 font-mono text-[13px] tracking-widest text-ink">
            {enrollment.secret}
          </code>
        ) : null}
      </div>

      <div>
        <div className="mb-2 text-xs font-bold text-ink">Code affiche par l application</div>
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={(complete) => onConfirm(complete)}
          disabled={busy}
        />
      </div>

      <div className="flex gap-2.5">
        <Button onClick={() => onConfirm()} disabled={busy || code.length < 6}>
          {busy ? 'Verification…' : 'Confirmer'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
      </div>
    </div>
  )
}

function ActiveState({ status, onDisabled, setError }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setBusy(true)

    try {
      await disableMfa({ password, code })
      setOpen(false)
      setPassword('')
      setCode('')
      onDisabled()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-xl bg-success-bg px-3.5 py-3 text-[12.5px] font-semibold text-success">
        Un code sera demande a chaque connexion.
      </div>

      <div className="flex justify-between text-[13px]">
        <span className="text-muted">Codes de secours restants</span>
        <span
          className={cx(
            'font-mono font-semibold',
            status.recoveryCodesLeft <= 2 ? 'text-warn' : 'text-ink',
          )}
        >
          {status.recoveryCodesLeft} / 8
        </span>
      </div>

      {status.required ? (
        <p className="text-[12.5px] leading-relaxed text-muted">
          Votre role impose la double authentification : elle ne peut pas etre retiree. En cas de
          telephone perdu, la direction peut la reinitialiser.
        </p>
      ) : open ? (
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line-soft pt-3.5">
          <Field label="Mot de passe">
            <PasswordInput
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="Code de verification">
            <input
              required
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              className={`${inputClass} font-mono tracking-widest`}
            />
          </Field>
          <div className="flex gap-2.5">
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? 'Desactivation…' : 'Confirmer la desactivation'}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="danger" onClick={() => setOpen(true)} className="self-start">
          Desactiver
        </Button>
      )}
    </div>
  )
}

function RecoveryCodes({ codes, onDone }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-xl border border-warn/30 bg-warn-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-warn-ink">
        <strong>Notez ces codes maintenant.</strong> Ils ne seront plus jamais affiches. Chacun
        remplace une fois le code du telephone, si vous n y avez pas acces.
      </div>

      <div className="grid grid-cols-2 gap-2">
        {codes.map((entry) => (
          <code
            key={entry}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-center font-mono text-[13px] tracking-wider text-ink"
          >
            {entry}
          </code>
        ))}
      </div>

      <div className="flex gap-2.5">
        <Button
          variant="secondary"
          onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}
        >
          Copier
        </Button>
        <Button onClick={onDone}>Je les ai notes</Button>
      </div>
    </div>
  )
}

export default MfaCard
