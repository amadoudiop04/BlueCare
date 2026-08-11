import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import PageHeader, { PageBody } from '@/components/layout/PageHeader.jsx'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { fetchChildGoals, fetchChildren } from '@/api/children.api.js'
import { createSession, fetchPendingReports, submitReport } from '@/api/tracking.api.js'
import { useApi } from '@/hooks/useApi.js'
import { formatDate, initials, percent, todayIso } from '@/lib/format.js'
import { cx, inputClass } from '@/lib/ui.js'

/**
 * Saisie d'un compte-rendu de séance.
 *
 * Le formulaire de la maquette suppose une séance déjà créée. Ici on enchaine
 * les deux en une soumission : création de la séance puis depot du
 * compte-rendu, parce qu'un éducateur saisit presque toujours après coup.
 */

const MOODS = [
  { value: 'very-good', label: 'Très bon', color: '#14866B' },
  { value: 'good', label: 'Bon', color: '#1E5FD8' },
  { value: 'neutral', label: 'Neutre', color: '#5A6A85' },
  { value: 'difficult', label: 'Difficile', color: '#C77A0A' },
  { value: 'very-difficult', label: 'Très difficile', color: '#C0405A' },
]

const ATTENTION_TAGS = [
  'Fatigue',
  'Douleur signalee',
  'Conflit avec un pair',
  'Progrès notable',
  'A revoir avec la famille',
]

const SESSION_TYPES = [
  { value: 'individual', label: 'Séance individuelle' },
  { value: 'group', label: 'Atelier collectif' },
  { value: 'therapy', label: 'Séance therapeutique' },
  { value: 'outing', label: 'Sortie' },
  { value: 'other', label: 'Autre' },
]

const MAX_OBSERVATIONS = 5000

function SessionReportPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const { data, error, loading } = useApi(
    () =>
      Promise.all([
        fetchChildren({ pageSize: 100 }),
        fetchPendingReports().catch(() => ({ items: [], summary: null })),
      ]).then(([children, pending]) => ({ children: children.items, pending })),
    [],
  )

  const [date, setDate] = useState(todayIso())
  const [type, setType] = useState('individual')
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState('good')
  const [observations, setObservations] = useState('')
  const [tags, setTags] = useState([])
  const [healthFlagged, setHealthFlagged] = useState(false)
  const [healthDescription, setHealthDescription] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)

  /*
   * Les valeurs par défaut (premier enfant, premier objectif, taux actuel)
   * sont DEDUITES plutôt que posees dans un effet : un `setState` synchrone
   * dans un effet déclenche un rendu en cascade à chaque chargement. Un choix
   * explicite de l'utilisateur (`null` = pas encore choisi) prend le dessus.
   */
  const [pickedChildId, setPickedChildId] = useState(params.get('enfant'))
  const [pickedGoalId, setPickedGoalId] = useState(null)
  const [pickedProgress, setPickedProgress] = useState(null)

  const children = data?.children ?? []
  const childId =
    pickedChildId && children.some((entry) => entry.id === pickedChildId)
      ? pickedChildId
      : (children[0]?.id ?? '')

  const goals = useApi(
    () => (childId ? fetchChildGoals(childId) : Promise.resolve({ items: [], summary: null })),
    [childId],
  )

  const goalItems = goals.data?.items ?? []
  const goalId =
    pickedGoalId && goalItems.some((goal) => goal.id === pickedGoalId)
      ? pickedGoalId
      : (goalItems[0]?.id ?? '')

  // Deux recherches dans des listes de quelques dizaines d'éléments :
  // les memoiser couterait plus cher que de les refaire.
  const child = children.find((entry) => entry.id === childId) ?? null
  const selectedGoal = goalItems.find((entry) => entry.id === goalId) ?? null

  // Tant que le curseur n'a pas été bouge, il affiche le taux actuel de l'objectif.
  const goalProgress = pickedProgress ?? selectedGoal?.progress ?? 0

  const selectChild = (value) => {
    setPickedChildId(value)
    setPickedGoalId(null)
    setPickedProgress(null)
  }

  const selectGoal = (value) => {
    setPickedGoalId(value)
    setPickedProgress(null)
  }

  const toggleTag = (tag) =>
    setTags((current) => (current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag]))

  const onSubmit = async (event) => {
    event.preventDefault()
    setSubmitError(null)
    setFieldErrors(null)
    setSubmitting(true)

    try {
      const session = await createSession(childId, {
        date,
        type,
        title: title.trim() || undefined,
        goalIds: goalId ? [goalId] : [],
      })

      await submitReport(session.id, {
        mood,
        observations: observations.trim(),
        goalProgress: goalId ? [{ goalId, progress: Number(goalProgress) }] : [],
        attentionPoints: tags,
        healthFlag: healthFlagged
          ? { flagged: true, description: healthDescription.trim() }
          : { flagged: false },
      })

      navigate(`/enfants/${childId}`)
    } catch (requestError) {
      setSubmitError(requestError)
      setFieldErrors(requestError.details ?? null)
    } finally {
      setSubmitting(false)
    }
  }

  const errorFor = (field) => fieldErrors?.[field]?.[0]

  return (
    <>
      <PageHeader crumb="Suivi pédagogique" title="Nouveau compte-rendu de séance" />

      <PageBody>
        <ErrorNotice error={error} />

        {loading ? (
          <Skeleton height={480} className="rounded-2xl" />
        ) : (
          <form onSubmit={onSubmit} className="grid items-start gap-[18px] xl:grid-cols-[1fr_300px]">
            <Card className="flex flex-col gap-6 px-7 py-[26px]">
              <div className="flex items-center gap-3.5 border-b border-line-soft pb-5">
                <Avatar size={46} radius={14}>
                  {child ? initials(child.firstName, child.lastName) : '··'}
                </Avatar>
                <div className="flex-1">
                  <div className="text-base font-bold tracking-[-0.01em]">
                    {child ? `${child.firstName} ${child.lastName}` : 'Selectionnez un enfant'}
                    {child ? ` · séance du ${formatDate(date)}` : ''}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {child ? `${child.group} · ${child.age} ans` : 'Périmètre : vos groupes'}
                  </div>
                </div>
                <Badge tone="warn">BROUILLON</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-ink">Enfant</span>
                  <select
                    value={childId}
                    onChange={(event) => selectChild(event.target.value)}
                    className={inputClass}
                    required
                  >
                    {children.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.firstName} {entry.lastName} · {entry.group}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-ink">Date</span>
                  <input
                    type="date"
                    value={date}
                    max={todayIso()}
                    onChange={(event) => setDate(event.target.value)}
                    className={inputClass}
                    required
                  />
                  {errorFor('date') ? (
                    <span className="text-[11.5px] font-medium text-danger">{errorFor('date')}</span>
                  ) : null}
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-ink">Type de séance</span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className={inputClass}
                  >
                    {SESSION_TYPES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold text-ink">Intitule (optionnel)</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Atelier pictogrammes"
                  className={inputClass}
                />
              </label>

              <div>
                <div className="mb-3 text-xs font-bold tracking-[0.02em] text-ink">Humeur observee</div>
                <div className="flex flex-wrap gap-2.5">
                  {MOODS.map((entry) => {
                    const active = mood === entry.value
                    return (
                      <button
                        key={entry.value}
                        type="button"
                        onClick={() => setMood(entry.value)}
                        aria-pressed={active}
                        className={cx(
                          'flex-1 cursor-pointer rounded-[10px] border px-2 py-3.5 text-[13px] font-semibold',
                          !active && 'border-line bg-white text-muted-strong hover:border-brand',
                        )}
                        style={active ? { background: entry.color, borderColor: entry.color, color: '#fff' } : undefined}
                      >
                        {entry.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs font-bold text-ink">Objectif travaille</div>

                {goals.loading ? (
                  <Skeleton height={64} />
                ) : goalItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line px-4 py-3.5 text-[13px] text-muted">
                    Cet enfant n'a pas encore d'objectif. Le compte-rendu reste enregistrable.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {goalItems.map((goal) => {
                      const active = goalId === goal.id
                      return (
                        <label
                          key={goal.id}
                          className={cx(
                            'flex cursor-pointer items-center gap-3 rounded-[11px] border px-4 py-3.5',
                            active ? 'border-brand bg-[#F7FAFF]' : 'border-line bg-white hover:border-brand-100',
                          )}
                        >
                          <input
                            type="radio"
                            name="goal"
                            className="sr-only"
                            checked={active}
                            onChange={() => selectGoal(goal.id)}
                          />
                          <span
                            className="h-[17px] w-[17px] flex-none rounded-full bg-white"
                            style={{ border: active ? '5px solid #1E5FD8' : '1.5px solid #CFD8E8' }}
                          />
                          <span className="flex-1 text-[13.5px] font-semibold text-ink">{goal.title}</span>
                          <span className="font-mono text-xs text-muted">{percent(goal.progress)}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {selectedGoal ? (
                  <div className="mt-4 rounded-xl bg-canvas px-4 py-3.5">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
                      <span>Nouveau taux d'avancement</span>
                      <span className="font-mono text-sm">{goalProgress}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={goalProgress}
                      onChange={(event) => setPickedProgress(Number(event.target.value))}
                      className="w-full accent-brand"
                    />
                    <div className="mt-1.5 text-[11.5px] text-muted">
                      Etait a {percent(selectedGoal.progress)} avant cette séance.
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-bold text-ink">Observations de séance</div>
                  <span className="font-mono text-[11px] text-muted-light">
                    {observations.length} / {MAX_OBSERVATIONS}
                  </span>
                </div>
                <textarea
                  value={observations}
                  onChange={(event) => setObservations(event.target.value.slice(0, MAX_OBSERVATIONS))}
                  required
                  minLength={10}
                  rows={5}
                  placeholder="Ce qui a été travaille, comment l'enfant a reagi, ce qui a fonctionne…"
                  className={cx(inputClass, 'min-h-[120px] resize-y leading-[1.65]')}
                />
                {errorFor('observations') ? (
                  <div className="mt-1.5 text-[11.5px] font-medium text-danger">
                    {errorFor('observations')}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="mb-3 text-xs font-bold text-ink">Points d'attention</div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {ATTENTION_TAGS.map((tag) => {
                    const active = tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        aria-pressed={active}
                        className={cx(
                          'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold',
                          active
                            ? 'border-brand-100 bg-brand-50 text-brand-dark'
                            : 'border-line bg-white text-muted-strong hover:border-brand',
                        )}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-[11px] border border-line px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={healthFlagged}
                    onChange={(event) => setHealthFlagged(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-danger"
                  />
                  <span className="flex-1">
                    <span className="block text-[13px] font-semibold text-ink">
                      Signaler un point de santé a l'infirmière
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">
                      Génère une alerte immédiate dans son fil de notifications.
                    </span>
                  </span>
                </label>

                {healthFlagged ? (
                  <div className="mt-2.5">
                    <textarea
                      value={healthDescription}
                      onChange={(event) => setHealthDescription(event.target.value)}
                      required
                      rows={2}
                      placeholder="Ce que vous avez observe, et depuis quand…"
                      className={cx(inputClass, 'resize-y')}
                    />
                    {errorFor('healthFlag.description') ? (
                      <div className="mt-1.5 text-[11.5px] font-medium text-danger">
                        {errorFor('healthFlag.description')}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <ErrorNotice error={submitError} />

              <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
                <Button type="submit" disabled={submitting || !childId} className="px-[22px] py-3.5 text-[13.5px]">
                  {submitting ? 'Enregistrement…' : 'Valider le compte-rendu'}
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" onClick={() => navigate(-1)}>
                  Annuler
                </Button>
              </div>
            </Card>

            <div className="flex flex-col gap-[18px]">
              <Card className="p-5">
                <div className="mb-3.5 text-sm font-bold">Impact sur l'objectif</div>
                {selectedGoal ? (
                  <>
                    <div className="mb-3 flex items-end gap-2.5">
                      <div className="font-mono text-3xl font-medium leading-none">{goalProgress}%</div>
                      <div
                        className={cx(
                          'pb-1 text-[12.5px] font-semibold',
                          goalProgress >= (selectedGoal.progress ?? 0) ? 'text-success' : 'text-warn',
                        )}
                      >
                        {goalProgress - (selectedGoal.progress ?? 0) >= 0 ? '+' : ''}
                        {goalProgress - (selectedGoal.progress ?? 0)} pts
                      </div>
                    </div>
                    <ProgressBar value={goalProgress} height={8} />
                    <div className="mt-3 text-xs leading-[1.55] text-muted">
                      Le taux de l'objectif est mis à jour des la validation du compte-rendu.
                    </div>
                  </>
                ) : (
                  <div className="text-[12.5px] text-muted">
                    Selectionnez un objectif pour voir l'impact de cette séance.
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <CardHeader
                  className="mb-3.5"
                  title="Séances en attente"
                  subtitle={`${data?.pending?.summary?.total ?? 0} sans compte-rendu`}
                />
                {(data?.pending?.items ?? []).length === 0 ? (
                  <div className="text-[12.5px] text-muted">Tout est à jour.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.pending.items.slice(0, 4).map(({ session, overdue, daysLate }) => (
                      <div key={session.id} className="flex items-center gap-2.5">
                        <span className="w-10 flex-none font-mono text-[11px] text-muted-light">
                          {formatDate(session.date).slice(0, 5)}
                        </span>
                        <span className="flex-1 truncate text-[12.5px] text-muted-strong">
                          {session.title ?? session.type}
                        </span>
                        {overdue ? <Badge tone="warn">{daysLate} j</Badge> : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </form>
        )}
      </PageBody>
    </>
  )
}

export default SessionReportPage
