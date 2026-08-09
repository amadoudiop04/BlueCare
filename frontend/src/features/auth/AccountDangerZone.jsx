import { useState } from 'react'

import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx'
import PasswordInput from '@/components/ui/PasswordInput.jsx'
import { Button, Card, CardHeader, Field, Skeleton } from '@/components/ui/primitives.jsx'
import { deleteAccount, fetchAccountDeletion } from '@/api/auth.api.js'
import { useApi } from '@/hooks/useApi.js'
import { useAuth } from '@/hooks/useAuth.js'
import { inputClass } from '@/lib/ui.js'

/**
 * Suppression de son propre compte.
 *
 * Le serveur annonce d'abord ce qu il fera : effacer entierement la ligne si
 * rien n'y est rattache, ou n'en garder qu une coquille anonyme si des
 * comptes-rendus portent la signature de la personne. On affiche cette
 * distinction AVANT de demander confirmation — personne ne doit decouvrir
 * apres coup que son nom reste attache a un dossier.
 */
function AccountDangerZone() {
  const { user, logout } = useAuth()
  const { data: preview, loading, error } = useApi(fetchAccountDeletion, [])

  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setActionError(null)

    try {
      await deleteAccount({ password, code: code || undefined })
      // La session est deja close cote serveur : on vide l etat local et
      // l utilisateur retombe sur l ecran de connexion.
      await logout()
    } catch (requestError) {
      setActionError(requestError)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card className="px-6 py-[22px]">
        <Skeleton height={120} />
      </Card>
    )
  }

  // Le dernier compte de direction ne peut pas partir : plus personne ne
  // pourrait creer de comptes ni reinitialiser une double authentification.
  const blocked = preview?.lastAdministrator

  return (
    <>
      <Card className="border-danger/25 px-6 py-[22px]">
        <CardHeader
          className="mb-4"
          title="Supprimer mon compte"
          subtitle={error ? 'Etat indisponible' : undefined}
        />

        {blocked ? (
          <div className="rounded-xl border border-warn/30 bg-warn-bg px-4 py-3 text-[12.5px] leading-relaxed text-warn-ink">
            Vous etes le dernier compte de direction actif. Nommez un remplacant avant de
            supprimer le votre, sinon plus personne ne pourra gerer les comptes du centre.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-muted-strong">
              {preview?.mode === 'anonymise' ? (
                <>
                  Vos donnees personnelles seront effacees et vous ne pourrez plus vous connecter.
                  Les <strong className="text-ink">{preview.authoredRecords} enregistrements</strong>{' '}
                  que vous avez signes ({preview.reports} compte
                  {preview.reports > 1 ? 's' : ''}-rendu{preview.reports > 1 ? 's' : ''},{' '}
                  {preview.sessions} seance{preview.sessions > 1 ? 's' : ''}) resteront au dossier
                  des enfants, sous la mention « Compte supprime » : un dossier de suivi doit garder
                  la trace de qui a ecrit quoi.
                </>
              ) : (
                <>
                  Aucun compte-rendu ni seance n est rattache a votre compte : il sera{' '}
                  <strong className="text-ink">entierement efface</strong>, sans rien laisser.
                </>
              )}
            </p>

            <Button variant="danger" onClick={() => setOpen(true)} className="self-start">
              Supprimer mon compte
            </Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={open}
        title="Supprimer definitivement votre compte ?"
        description="Cette action est irreversible. Vous serez deconnecte immediatement et ne pourrez plus acceder a l application."
        confirmLabel="Supprimer mon compte"
        confirmText={user.email}
        busy={busy}
        error={actionError}
        onCancel={() => {
          setOpen(false)
          setPassword('')
          setCode('')
          setActionError(null)
        }}
        onConfirm={confirm}
      >
        <div className="flex flex-col gap-3">
          <Field label="Votre mot de passe">
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {user.mfaEnabled ? (
            <Field label="Code de verification" hint="Affiche par votre application d authentification">
              <input
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                className={`${inputClass} font-mono tracking-widest`}
              />
            </Field>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  )
}

export default AccountDangerZone
