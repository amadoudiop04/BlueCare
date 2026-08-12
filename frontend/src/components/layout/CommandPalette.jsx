import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ShortcutHint from '@/components/layout/ShortcutHint.jsx'
import { fetchChildren } from '@/api/children.api.js'
import { useAuth } from '@/hooks/useAuth.js'
import { readCache, writeCache } from '@/lib/cache.js'
import { initials } from '@/lib/format.js'
import { navigationFor } from '@/lib/navigation.js'
import { fold, hasSeenShortcutHint, isApple, rememberShortcutHint } from '@/lib/palette.js'
import { prefetchPath } from '@/lib/routes.js'
import { cx } from '@/lib/ui.js'

/**
 * Palette de navigation — Ctrl K, ⌘K sur Mac.
 *
 * Ouvrir la fiche d'un enfant demandait jusqu'ici trois écrans : barre
 * laterale, liste, recherche, clic. Or c'est le geste le plus frequent de la
 * journee d'un educateur. Ici, on tape trois lettres du prenom et on y est.
 *
 * La liste des enfants est chargee a la **première ouverture** seulement, puis
 * mémorisée comme le reste (`lib/cache.js`) : la palette ne coûte rien tant
 * qu'on ne s'en sert pas, et rien non plus les fois suivantes. Elle est videe
 * a la déconnexion, comme tout le cache.
 *
 * Tant que la palette est fermee, ce composant affiche a sa place l'astuce qui
 * annonce le raccourci (`ShortcutHint`). Les deux vivent ensemble parce qu'ils
 * partagent la même information : des que `Ctrl K` a servi une fois, l'astuce
 * n'a plus lieu d'être.
 */

const CHILDREN_CACHE_KEY = 'palette-children:[]'

/** Raccourcis d'écriture, doublés par les écrans qui les portent. */
const ACTIONS = [
  {
    label: 'Inscrire un nouvel enfant',
    hint: 'Fiche enfant',
    to: '/enfants/nouveau',
    roles: ['educator', 'director', 'admin'],
  },
  {
    label: 'Saisir un compte-rendu de séance',
    hint: 'Suivi pédagogique',
    to: '/comptes-rendus',
    roles: ['educator', 'director', 'admin'],
  },
  {
    label: 'Faire l’appel du jour',
    hint: 'Présences',
    to: '/presences',
    roles: ['educator', 'nurse', 'director', 'admin'],
  },
  {
    label: 'Créer un compte',
    hint: 'Gestion des comptes',
    to: '/comptes/nouveau',
    roles: ['director', 'admin'],
  },
]

function CommandPalette() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState(0)
  const [children, setChildren] = useState(() => readCache(CHILDREN_CACHE_KEY)?.data ?? null)
  // Lu une fois au montage : l'astuce a-t-elle déjà été vue sur ce poste ?
  const [hintSeen, setHintSeen] = useState(hasSeenShortcutHint)

  const inputRef = useRef(null)
  const listRef = useRef(null)

  const close = useCallback(() => {
    setOpen(false)
    setSearch('')
    setCursor(0)
  }, [])

  /** L'astuce a fait son office : ne plus la montrer, sur ce poste ni ailleurs. */
  const forgetHint = useCallback(() => {
    rememberShortcutHint()
    setHintSeen(true)
  }, [])

  // Ctrl K depuis n'importe quel écran : c'est la seule entree de la palette.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key?.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        // Sinon Chrome ouvre sa propre barre de recherche.
        event.preventDefault()
        setOpen((value) => !value)
        // Se servir du raccourci vaut mieux que fermer l'astuce : elle a été
        // lue, et rien ne sert de la reproposer a quelqu'un qui l'applique.
        forgetHint()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [forgetHint])

  /*
   * Les enfants ne sont demandes qu'a la première ouverture. Les charger au
   * démarrage ferait payer a chaque connexion une requête dont la plupart des
   * sessions n'ont pas besoin.
   */
  useEffect(() => {
    if (!open || children) return undefined

    let cancelled = false

    fetchChildren({ pageSize: 100 })
      .then(({ items }) => {
        writeCache(CHILDREN_CACHE_KEY, items)
        if (!cancelled) setChildren(items)
      })
      // Une palette sans les enfants reste utile : elle garde la navigation.
      .catch(() => {
        if (!cancelled) setChildren([])
      })

    return () => {
      cancelled = true
    }
  }, [open, children])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const results = useMemo(() => {
    const needle = fold(search.trim())
    const matches = (text) => !needle || fold(text).includes(needle)

    const screens = navigationFor(user.role)
      .filter((item) => matches(item.label))
      .map((item) => ({ id: `nav:${item.to}`, kind: 'screen', label: item.label, to: item.to }))

    const actions = ACTIONS.filter(
      (action) => action.roles.includes(user.role) && matches(`${action.label} ${action.hint}`),
    ).map((action) => ({
      id: `action:${action.to}`,
      kind: 'action',
      label: action.label,
      hint: action.hint,
      to: action.to,
    }))

    const files = (children ?? [])
      .filter((child) => matches(`${child.firstName} ${child.lastName} ${child.group ?? ''}`))
      .slice(0, 6)
      .map((child) => ({
        id: `child:${child.id}`,
        kind: 'child',
        label: `${child.firstName} ${child.lastName}`,
        hint: child.group,
        badge: initials(child.firstName, child.lastName),
        to: `/enfants/${child.id}`,
      }))

    // Les fiches d'abord des qu'on tape : c'est ce qu'on vient chercher.
    return needle ? [...files, ...screens, ...actions] : [...screens, ...actions]
  }, [children, search, user.role])

  /*
   * La liste des enfants arrive après coup : elle peut raccourcir la liste
   * sous une selection déjà posee. On borne a la lecture plutôt que de
   * corriger `cursor` dans un effet, qui provoquerait un rendu de plus.
   */
  const active = Math.min(cursor, Math.max(0, results.length - 1))
  const selected = results[active] ?? null

  // Se deplacer dans la liste vaut intention : l'écran vise est prechargé.
  useEffect(() => {
    if (open) prefetchPath(selected?.to)
  }, [open, selected])

  const go = useCallback(
    (item) => {
      if (!item) return
      close()
      navigate(item.to)
    },
    [close, navigate],
  )

  // Palette fermee : reste l'astuce qui apprend a l'ouvrir, tant qu'elle sert.
  if (!open) return hintSeen ? null : <ShortcutHint onDismiss={forgetHint} />

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return

      const step = event.key === 'ArrowDown' ? 1 : -1
      // Le parcours boucle : depuis la dernière ligne, ↓ revient a la première.
      const next = (active + step + results.length) % results.length
      setCursor(next)
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      go(selected)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade justify-center bg-navy/45 px-4 pt-[12vh] backdrop-blur-[2px]"
      style={{ animationDuration: '140ms' }}
      role="presentation"
      onMouseDown={(event) => {
        // Fermeture au clic a côte, mais pas au clic dans la palette.
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche et navigation"
        onKeyDown={onKeyDown}
        className="flex h-fit max-h-[70vh] w-full max-w-[560px] animate-up flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-lift"
        style={{ animationDuration: '180ms' }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <span
            className="h-3.5 w-3.5 flex-none rounded-full border-[1.6px] border-muted"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              // La liste change sous la selection : elle repart en tête, sinon
              // elle designerait une ligne qui n'est plus la même.
              setCursor(0)
            }}
            placeholder="Rechercher un enfant, un écran…"
            aria-label="Rechercher un enfant ou un écran"
            className="w-full min-w-0 border-0 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-muted-light"
          />
          <kbd className="hidden flex-none rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted sm:block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2" role="listbox" aria-label="Résultats">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-[13px] text-muted">
              {children === null ? 'Chargement des fiches…' : `Aucun résultat pour « ${search} »`}
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setCursor(index)}
                onClick={() => go(item)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left',
                  index === active ? 'bg-brand-50' : 'bg-transparent',
                )}
              >
                <span
                  className={cx(
                    'flex h-7 w-7 flex-none items-center justify-center rounded-lg font-mono text-[10px] font-bold',
                    item.kind === 'child'
                      ? 'bg-brand text-white'
                      : 'bg-canvas text-muted-strong',
                  )}
                  aria-hidden="true"
                >
                  {item.badge ?? (item.kind === 'action' ? '+' : '→')}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">
                    {item.label}
                  </span>
                  {item.hint ? (
                    <span className="block truncate text-[11.5px] text-muted">{item.hint}</span>
                  ) : null}
                </span>

                <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-light">
                  {item.kind === 'child' ? 'Fiche' : item.kind === 'action' ? 'Action' : 'Écran'}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-canvas px-4 py-2.5 text-[11px] text-muted">
          <span>
            <kbd className="font-mono font-semibold">↑↓</kbd> naviguer
          </span>
          <span>
            <kbd className="font-mono font-semibold">↵</kbd> ouvrir
          </span>
          <span className="ml-auto font-mono">{isApple ? '⌘' : 'Ctrl'} K</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
