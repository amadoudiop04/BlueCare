import { useState } from 'react'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { fetchMedicationDoses, recordAdministration } from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { formatDate, initials, todayIso } from '@/lib/format.js'

/**
 * Rappels de medicaments du jour.
 * Tracer une prise fait disparaitre le rappel correspondant du fil de
 * notifications : c'est le meme calcul cote serveur.
 */

const STATUS_TONE = { given: 'success', refused: 'warn', missed: 'danger', pending: 'neutral' }
const STATUS_LABEL = {
  given: 'Administre',
  refused: 'Refuse',
  missed: 'Non administre',
  pending: 'A donner',
}

function MedicationsPage() {
  const [date, setDate] = useState(todayIso())
  const { data, error, loading, reload } = useApi(() => fetchMedicationDoses({ date }), [date])

  return (
    <>
      <PageHeader
        crumb="Suivi sante"
        title="Rappels de medicaments"
        action={
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-[9px] border border-line bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand"
          />
        }
      />

      <PageBody>
        <ErrorNotice error={error} onRetry={reload} />

        {loading ? (
          <Skeleton height={320} className="rounded-2xl" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryTile label="Prises prevues" value={data.summary.total} />
              <SummaryTile label="A tracer" value={data.summary.pending} tone="warn" />
              <SummaryTile label="Administrees" value={data.summary.given} tone="success" />
            </div>

            <Card className="overflow-hidden">
              <div className="border-b border-line-soft px-6 pb-4 pt-5">
                <CardHeader
                  title={`Prises du ${formatDate(date)}`}
                  subtitle="Chaque prise est tracee individuellement, avec son horaire prevu"
                />
              </div>

              {data.items.length === 0 ? (
                <div className="px-6 py-6">
                  <EmptyState
                    title="Aucune prise prevue"
                    description="Aucun traitement actif ne demande d administration ce jour-la."
                  />
                </div>
              ) : (
                data.items.map((dose) => (
                  <DoseRow
                    key={`${dose.medicationId}:${dose.scheduledTime}`}
                    dose={dose}
                    date={date}
                    onRecorded={reload}
                  />
                ))
              )}
            </Card>
          </>
        )}
      </PageBody>
    </>
  )
}

function SummaryTile({ label, value, tone = 'brand' }) {
  const color = { brand: '#1E5FD8', warn: '#C77A0A', success: '#14866B' }[tone]

  return (
    <Card className="px-5 py-[18px]">
      <div className="text-[11.5px] font-semibold text-muted-strong">{label}</div>
      <div className="mt-2 text-3xl font-bold leading-none tracking-[-0.03em]" style={{ color }}>
        {value}
      </div>
    </Card>
  )
}

function DoseRow({ dose, date, onRecorded }) {
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  const record = async (status) => {
    setSaving(status)
    setError(null)

    try {
      await recordAdministration(dose.medicationId, {
        date,
        scheduledTime: dose.scheduledTime,
        status,
        ...(status === 'given' ? { givenAt: new Date().toTimeString().slice(0, 5) } : {}),
      })
      onRecorded()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-line-soft px-6 py-4">
      <div className="w-16 flex-none font-mono text-[15px] font-semibold text-ink">
        {dose.scheduledTime}
      </div>

      <Avatar color={dose.status === 'pending' ? '#C77A0A' : '#14866B'}>
        {dose.child ? initials(dose.child.firstName, dose.child.lastName) : '··'}
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">
          {dose.name} · {dose.dosage}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {dose.child ? `${dose.child.firstName} ${dose.child.lastName} · ${dose.child.group}` : ''}
          {dose.instructions ? ` · ${dose.instructions}` : ''}
        </div>
        {error ? <div className="mt-1 text-[11.5px] font-semibold text-danger">{error.message}</div> : null}
      </div>

      <Badge tone={STATUS_TONE[dose.status]}>{STATUS_LABEL[dose.status]}</Badge>

      {dose.status === 'pending' ? (
        <div className="flex gap-2">
          <Button onClick={() => record('given')} disabled={saving !== null} className="px-3 py-2 text-xs">
            {saving === 'given' ? '…' : 'Administre'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => record('refused')}
            disabled={saving !== null}
            className="px-3 py-2 text-xs"
          >
            Refuse
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default MedicationsPage
