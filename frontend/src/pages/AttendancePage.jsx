import { useState } from 'react'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import {
  deleteAttendance,
  fetchAttendanceAlerts,
  fetchAttendanceSheet,
  recordAttendance,
} from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { formatDate, initials, todayIso, weekDays } from '@/lib/format.js'
import { cx } from '@/lib/ui.js'

/**
 * Présences de la semaine.
 *
 * L API sert une journee a la fois (`GET /attendance?date=`) : la grille
 * hebdomadaire est reconstituee en interrogeant les cinq jours ouvres en
 * parallele. Toute saisie est corrigeable — le serveur remplace la ligne du
 * jour plutôt que d'en créer une seconde.
 */

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

const STATUSES = [
  { value: 'present', label: 'Présent', color: '#1E5FD8' },
  { value: 'late', label: 'Retard', color: '#F0C98B' },
  { value: 'absent', label: 'Absent', color: '#E7A9B5' },
  { value: 'excused', label: 'Absence justifiée', color: '#B9CDF6' },
]

const STATUS_COLOR = Object.fromEntries(STATUSES.map((entry) => [entry.value, entry.color]))
const STATUS_LABEL = Object.fromEntries(STATUSES.map((entry) => [entry.value, entry.label]))

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
    // La feuille de la date choisie, pas celle du jour : c'est elle qu'on pointe.
    sheet: sheets[days.indexOf(reference)] ?? sheets.at(-1) ?? null,
  }
}

function AttendancePage() {
  const [reference, setReference] = useState(todayIso())
  const { data, error, loading, reload } = useApi(() => loadWeek(reference), [reference])

  return (
    <>
      <PageHeader
        crumb="Gestion des enfants"
        title="Présences quotidiennes"
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
            title="Aucun enfant dans votre périmètre"
            description="La feuille de présence se remplit avec les enfants de vos groupes."
          />
        ) : (
          <>
            <DailySheet sheet={data.sheet} onSaved={reload} />

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 pb-4 pt-5">
                <CardHeader
                  title={`Semaine du ${formatDate(data.days[0])}`}
                  subtitle="Cliquez une case pour pointer ou corriger ce jour"
                />
                <div className="flex flex-wrap gap-4 text-xs font-medium text-muted-strong">
                  {STATUSES.map((entry) => (
                    <div key={entry.value} className="flex items-center gap-[7px]">
                      <span
                        className="h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: entry.color }}
                      />
                      {entry.label}
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
                        const day = data.days[index]

                        return (
                          <div key={label} className="flex justify-center">
                            <button
                              type="button"
                              // Cliquer une case selectionne son jour : le pointage
                              // du haut bascule alors sur cette date.
                              onClick={() => day && setReference(day)}
                              disabled={!day}
                              title={
                                record
                                  ? `${STATUS_LABEL[record.status]}${record.reason ? ` · ${record.reason}` : ''} — cliquer pour corriger`
                                  : day
                                    ? 'Non saisi — cliquer pour pointer ce jour'
                                    : 'Jour a venir'
                              }
                              className={cx(
                                'block h-[22px] w-[22px] rounded-[7px] transition-transform',
                                day && 'cursor-pointer hover:scale-110',
                                !record && 'border border-dashed border-line-strong',
                                day === reference && 'ring-2 ring-brand/40 ring-offset-1',
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
                          <span className="text-xs text-line-strong">—</span>
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

/**
 * Pointage d'une journee : tous les enfants du périmètre, saisis ou non.
 * Le statut déjà enregistre est mis en avant et reste modifiable — une erreur
 * de pointage se corrige sur place, sans passer par un écran d'edition.
 */
function DailySheet({ sheet, onSaved }) {
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  if (!sheet) return null

  const run = async (key, action) => {
    setSaving(key)
    setError(null)

    try {
      await action()
      onSaved()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setSaving(null)
    }
  }

  const mark = (childId, status) =>
    run(`${childId}:${status}`, () =>
      recordAttendance({
        childId,
        date: sheet.date,
        status,
        // Le serveur exige ces champs selon le statut choisi.
        ...(status === 'late' ? { arrivalTime: new Date().toTimeString().slice(0, 5) } : {}),
        ...(status === 'excused' ? { reason: 'Absence signalee par la famille' } : {}),
      }),
    )

  const clear = (childId) => run(`${childId}:clear`, () => deleteAttendance(childId, sheet.date))

  const missing = sheet.entries.filter((entry) => !entry.record).length

  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-4"
        title={`Pointage du ${formatDate(sheet.date)}`}
        subtitle={
          missing === 0
            ? 'Feuille complète · cliquez un statut pour le corriger'
            : `${missing} enfant${missing > 1 ? 's' : ''} sans saisie`
        }
      />

      <ErrorNotice error={error} />

      <div className="flex flex-col gap-2.5">
        {sheet.entries.map((entry) => {
          const current = entry.record?.status ?? null

          return (
            <div
              key={entry.child.id}
              className={cx(
                'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
                current ? 'border-line-soft' : 'border-dashed border-line-strong bg-[#FCFDFF]',
              )}
            >
              <Avatar color={current ? STATUS_COLOR[current] : '#8494AD'}>
                {initials(entry.child.firstName, entry.child.lastName)}
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">
                  {entry.child.firstName} {entry.child.lastName}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted">
                  {current
                    ? `${STATUS_LABEL[current]}${entry.record.arrivalTime ? ` · arrivee ${entry.record.arrivalTime}` : ''}${entry.record.reason ? ` · ${entry.record.reason}` : ''}`
                    : 'Non saisi'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {STATUSES.map((status) => {
                  const active = current === status.value
                  const key = `${entry.child.id}:${status.value}`

                  return (
                    <button
                      key={status.value}
                      type="button"
                      disabled={saving !== null}
                      onClick={() => mark(entry.child.id, status.value)}
                      aria-pressed={active}
                      className={cx(
                        'cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold',
                        'disabled:cursor-not-allowed disabled:opacity-55',
                        active
                          ? 'border-transparent text-white'
                          : 'border-line bg-white text-muted-strong hover:border-brand hover:text-brand',
                      )}
                      style={active ? { background: status.color } : undefined}
                    >
                      {saving === key ? '…' : status.label}
                    </button>
                  )
                })}

                {current ? (
                  <button
                    type="button"
                    disabled={saving !== null}
                    onClick={() => clear(entry.child.id)}
                    title="Annuler la saisie de ce jour"
                    className="cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold text-muted hover:text-danger disabled:opacity-55"
                  >
                    {saving === `${entry.child.id}:clear` ? '…' : 'Effacer'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default AttendancePage
