import { useState } from 'react'

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  Skeleton,
} from '@/components/ui/primitives.jsx'
import { fetchSessions, revokeOtherSessions, revokeSession } from '@/api/auth.api.js'
import { useApi } from '@/hooks/useApi.js'
import { cx } from '@/lib/ui.js'

/**
 * Appareils connectes.
 *
 * Chaque session vit en base : la fermer ici la revoque immédiatement, sans
 * attendre l'expiration d'un jeton. C'est ce qui permet a quelqu'un qui a
 * oublié de se déconnecter d'un poste partagé de le faire à distance.
 */

/** L'user-agent brut est illisible : on en tire l'essentiel. */
function describeDevice(userAgent) {
  if (!userAgent) return 'Appareil inconnu'

  const system = /Windows/i.test(userAgent)
    ? 'Windows'
    : /Android/i.test(userAgent)
      ? 'Android'
      : /iPhone|iPad|iOS/i.test(userAgent)
        ? 'iOS'
        : /Mac OS/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Système inconnu'

  const browser = /Edg\//i.test(userAgent)
    ? 'Edge'
    : /Chrome\//i.test(userAgent)
      ? 'Chrome'
      : /Safari\//i.test(userAgent)
        ? 'Safari'
        : /Firefox\//i.test(userAgent)
          ? 'Firefox'
          : 'Navigateur'

  return `${browser} · ${system}`
}

function relativeTime(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)

  if (minutes < 2) return 'a l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  if (minutes < 1440) return `il y a ${Math.round(minutes / 60)} h`

  return `il y a ${Math.round(minutes / 1440)} j`
}

function SessionsCard() {
  const { data: sessions, error, loading, reload } = useApi(fetchSessions, [])
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)

  const run = async (key, action) => {
    setBusy(key)
    setActionError(null)

    try {
      await action()
      reload()
    } catch (requestError) {
      setActionError(requestError)
    } finally {
      setBusy(null)
    }
  }

  const others = (sessions ?? []).filter((session) => !session.current).length

  return (
    <Card className="px-6 py-[22px]">
      <CardHeader
        className="mb-4"
        title="Appareils connectes"
        subtitle="Fermer une session la revoque immédiatement"
        action={
          others > 0 ? (
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => run('all', revokeOtherSessions)}
              className="px-3.5 py-2 text-[12.5px]"
            >
              {busy === 'all' ? '…' : `Fermer les ${others} autres`}
            </Button>
          ) : null
        }
      />

      <ErrorNotice error={error ?? actionError} onRetry={error ? reload : undefined} />

      {loading ? (
        <Skeleton height={120} />
      ) : sessions.length === 0 ? (
        <EmptyState title="Aucune session" description="Aucun appareil n'est connecte." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cx(
                'flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3',
                session.current ? 'bg-success-bg' : 'bg-[#FAFBFE]',
              )}
            >
              <span
                className={cx(
                  'h-2 w-2 flex-none rounded-full',
                  session.current ? 'animate-pulseRing bg-success' : 'bg-line-strong',
                )}
              />

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-ink">
                  {describeDevice(session.userAgent)}
                </div>
                <div className="mt-0.5 font-mono text-[11.5px] text-muted">
                  {session.ip ?? 'adresse inconnue'} · vue {relativeTime(session.lastSeenAt)}
                </div>
              </div>

              {session.current ? (
                <Badge tone="success">Cette session</Badge>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => run(session.id, () => revokeSession(session.id))}
                  className="px-3 py-2 text-xs"
                >
                  {busy === session.id ? '…' : 'Fermer'}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default SessionsCard
