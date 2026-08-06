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
import { fetchAttendanceAlerts, fetchAttendanceSheet, recordAttendance } from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { formatDate, initials, todayIso, weekDays } from '@/lib/format.js'
import { cx } from '@/lib/ui.js'

/**
 * Presences de la semaine.
 *
 * L'API sert une journee a la fois (`GET /attendance?date=`) : la grille
 * hebdomadaire de la maquette est reconstituee en interrogeant les cinq jours
 * ouvres en parallele.
 */

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

const STATUS_COLOR = {
  present: '#1E5FD8',
  late: '#F0C98B',
  absent: '#E7A9B5',
  excused: '#B9CDF6',
}

const STATUS_LABEL = {
  present: 'Present',
  late: 'Retard',
  absent: 'Absent',
  excused: 'Absence justifiee',
}

async function loadWeek(reference) {
  const days = weekDays(reference).filter((day) => day <= todayIso())

  const [sheets, alerts] = await Promise.all([
    Promise.all(days.map((day) => fetchAttendanceSheet({ date: day }).catch(() => null))),
    fetchAttendanceAlerts().catch(() => ({ items: [] })),
  ])

  // Une ligne par enfant, une colonne par jour.
  const rows = new Map()

  sheets.forEach((sheet, dayIndex) => {
    if (!sheet) return

    for (const entry of sheet.entries) {
      if (!rows.has(entry.child.id)) {
        rows.set(entry.child.id, { child: entry.child, days: new Array(days.length).fill(null) })
      }
      rows.get(entry.child.id).days[dayIndex] = entry.record
    }
  })

  const alertByChild = new Map(alerts.items.map((item) => [item.child.id, item.alerts]))

  return {
    days,
    rows: [...rows.values()].map((row) => ({ ...row, alerts: alertByChild.get(row.child.id) ?? [] })),
    todaySheet: sheets[days.indexOf(todayIso())] ?? null,
  }
}

function AttendancePage() {
  const [reference, setReference] = useState(todayIso())
  const { data, error, loading, reload } = useApi(() => loadWeek(reference), [reference])

  return (
    <>
      <PageHeader
        crumb="Gestion des enfants"
        title="Presences quotidiennes"
        action={
          <input
            type="date"
            value={reference}
            max={todayIso()}
            onChange={(event) => setReference(event.target.value)}
            className="rounded-[9px] border border-line bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand"
          />
        }
      />

      <PageBody>
        <ErrorNotice error={error} onRetry={reload} />

        {loading ? (
          <Skeleton height={380} className="rounded-2xl" />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            title="Aucun enfant dans votre perimetre"
            description="La feuille de presence se remplit avec les enfants de vos groupes."
          />
        ) : (
          <>
            <TodaySheet sheet={data.todaySheet} onSaved={reload} />

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 pb-4 pt-5">
                <CardHeader
                  title={`Semaine du ${formatDate(data.days[0])}`}
                  subtitle="Jours ouvres · les cases vides n ont pas encore ete saisies"
                />
                <div className="flex flex-wrap gap-4 text-xs font-medium text-muted-strong">
                  {Object.entries(STATUS_LABEL).map(([status, label]) => (
                    <div key={status} className="flex items-center gap-[7px]">
                      <span
                        className="h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: STATUS_COLOR[status] }}
                      />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[680px]">
                  <div className="grid grid-cols-[1.6fr_repeat(5,1fr)_1.1fr] bg-[#FAFBFE] px-6 py-[11px] text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">
                    <div>Enfant</div>
                    {DAY_LABELS.map((label, index) => (
                      <div key={label} className="text-center" title={data.days[index]}>
                        {label}
                      </div>
                    ))}
                    <div className="text-right">Alerte</div>
                  </div>

                  {data.rows.map((row) => (
                    <div
                      key={row.child.id}
                      className="grid grid-cols-[1.6fr_repeat(5,1fr)_1.1fr] items-center border-t border-line-soft px-6 py-3"
                    >
                      <div className="flex items-center gap-[11px]">
                        <Avatar color={row.alerts.length > 0 ? '#C0405A' : '#1E5FD8'}>
                          {initials(row.child.firstName, row.child.lastName)}
                        </Avatar>
                        <div className="truncate text-[13.5px] font-semibold">
                          {row.child.firstName} {row.child.lastName}
                        </div>
                      </div>

                      {DAY_LABELS.map((label, index) => {
                        const record = row.days[index]
                        return (
                          <div key={label} className="flex justify-center">
                            <span
                              title={
                                record
                                  ? `${STATUS_LABEL[record.status]}${record.reason ? ` · ${record.reason}` : ''}`
                                  : 'Non saisi'
                              }
                              className={cx(
                                'block h-[22px] w-[22px] rounded-[7px]',
                                !record && 'border border-dashed border-line-strong',
                              )}
                              style={record ? { background: STATUS_COLOR[record.status] } : undefined}
                            />
                          </div>
                        )
                      })}

                      <div className="text-right">
                        {row.alerts.length > 0 ? (
                          <Badge tone="danger">{row.alerts[0].count} absences</Badge>
                        ) : (
                          <span className="text-xs text-line-strong">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}
      </PageBody>
    </>
  )
}

/** Pointage du jour : un bouton par statut, enregistre immediatement. */
function TodaySheet({ sheet, onSaved }) {
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  if (!sheet) return null

  const mark = async (childId, status) => {
    setSaving(`${childId}:${status}`)
    setError(null)

    try {
      await recordAttendance({
        childId,
        date: sheet.date,
        status,
        // Le serveur exige ces champs selon le statut choisi.
        ...(status === 'late' ? { arrivalTime: new Date().toTimeString().slice(0, 5) } : {}),
        ...(status === 'excused' ? { reason: 'Absence signalee par la famille' } : {}),
      })
      onSaved()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setSaving(null)
    }
  }

  const missing = sheet.entries.filter((entry) => !entry.record)

  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-4"
        title={`Pointage du ${formatDate(sheet.date)}`}
        subtitle={
          missing.length === 0
            ? 'Tous les enfants sont pointes.'
            : `${missing.length} enfant${missing.length > 1 ? 's' : ''} sans saisie`
        }
      />

      <ErrorNotice error={error} />

      {missing.length === 0 ? (
        <div className="rounded-xl bg-success-bg px-4 py-3 text-[12.5px] font-semibold text-success">
          Feuille complete pour aujourd hui.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {missing.map((entry) => (
            <div
              key={entry.child.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft px-4 py-3"
            >
              <Avatar>{initials(entry.child.firstName, entry.child.lastName)}</Avatar>
              <div className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                {entry.child.firstName} {entry.child.lastName}
              </div>
              <div className="flex gap-2">
                {['present', 'late', 'absent', 'excused'].map((status) => (
                  <Button
                    key={status}
                    variant="soft"
                    disabled={saving !== null}
                    onClick={() => mark(entry.child.id, status)}
                    className="px-3 py-2 text-xs"
                  >
                    {saving === `${entry.child.id}:${status}` ? '…' : STATUS_LABEL[status]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default AttendancePage
