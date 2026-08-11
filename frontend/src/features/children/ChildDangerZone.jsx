import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx'
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives.jsx'
import { archiveChild, purgeChild, restoreChild } from '@/api/children.api.js'

/**
 * Sortie d'un enfant des effectifs.
 *
 * Deux gestes très différents, volontairement séparés :
 *
 *   Archiver  — la fiche quitte les listes, tout l'historique reste. C'est ce
 *               qu'on fait quand un enfant n'est plus accueilli, et cela se
 *               defait d'un clic.
 *   Effacer   — la fiche et tout ce qui s'y rattache disparaissent. Répond au
 *               droit a l'effacement, et rien ne le rattrape.
 *
 * Seule la seconde demande de recopier le nom : mettre la même friction
 * partout apprend a cliquer sans lire.
 */
function ChildDangerZone({ child, counts, onArchived }) {
  const navigate = useNavigate()

  const [dialog, setDialog] = useState(null) // 'archive' | 'restore' | 'purge'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const archived = child.status === 'archived'

  const run = async (action, after) => {
    setBusy(true)
    setError(null)

    try {
      await action()
      setDialog(null)
      after()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className="border-danger/25 px-6 py-[22px]">
        <CardHeader
          className="mb-4"
          title="Sortie de l'enfant"
          subtitle="Réserve a la direction"
          action={archived ? <Badge tone="neutral">ARCHIVEE</Badge> : null}
        />

        <div className="flex flex-col gap-4">
          {archived ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-[13px] leading-relaxed text-muted-strong">
                Cette fiche est archivee : elle n'apparait plus dans les listes, mais tout son
                historique est conserve.
              </p>
              <Button variant="secondary" onClick={() => setDialog('restore')}>
                Reactiver
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-[13px] leading-relaxed text-muted-strong">
                <strong className="text-ink">Archiver</strong> retire l'enfant des listes et des
                feuilles de présence, sans rien effacer. C'est l'action a utiliser quand un enfant
                quitte le centre.
              </p>
              <Button variant="secondary" onClick={() => setDialog('archive')}>
                Archiver
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
            <p className="max-w-md text-[13px] leading-relaxed text-muted-strong">
              <strong className="text-danger">Effacer définitivement</strong> supprime la fiche et
              toutes les données rattachees. Aucune restauration n'est possible.
            </p>
            <Button variant="danger" onClick={() => setDialog('purge')}>
              Effacer définitivement
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={dialog === 'archive'}
        title={`Archiver la fiche de ${child.firstName} ${child.lastName} ?`}
        description="L'enfant sort des listes et des feuilles de présence. L'historique reste consultable, et l'archivage se defait a tout moment."
        confirmLabel="Archiver"
        tone="primary"
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={() => run(() => archiveChild(child.id), onArchived)}
      />

      <ConfirmDialog
        open={dialog === 'restore'}
        title={`Reactiver ${child.firstName} ${child.lastName} ?`}
        description="La fiche revient dans les listes et les feuilles de présence."
        confirmLabel="Reactiver"
        tone="primary"
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={() => run(() => restoreChild(child.id), onArchived)}
      />

      <ConfirmDialog
        open={dialog === 'purge'}
        title="Effacer définitivement cette fiche ?"
        description="Cette action est irreversible. Si l'enfant a simplement quitte le centre, preferez l'archivage."
        confirmLabel="Effacer définitivement"
        confirmText={child.lastName}
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={() => run(() => purgeChild(child.id), () => navigate('/enfants'))}
      >
        <div className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-danger">
            Seront supprimés
          </div>
          <ul className="flex list-inside list-disc flex-col gap-1 text-[12.5px] text-danger">
            <li>la fiche de {child.firstName} {child.lastName}</li>
            <li>tout l'historique de présences</li>
            <li>
              {counts.goals} objectif{counts.goals > 1 ? 's' : ''} et {counts.sessions} séance
              {counts.sessions > 1 ? 's' : ''}, comptes-rendus compris
            </li>
            {counts.medications > 0 ? (
              <li>
                {counts.medications} traitement{counts.medications > 1 ? 's' : ''} et les prises
                tracées
              </li>
            ) : null}
            <li>sa participation aux activités de la galerie</li>
          </ul>
        </div>
      </ConfirmDialog>
    </>
  )
}

export default ChildDangerZone
