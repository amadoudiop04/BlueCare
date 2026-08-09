import { cx } from '@/lib/ui.js'

/**
 * Primitives visuelles de la maquette.
 *
 * Regroupees dans un seul module : ce sont des briques de quelques lignes,
 * toujours utilisées ensemble, et les séparer en huit fichiers rendrait les
 * imports des écrans illisibles.
 */

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx('rounded-2xl border border-line bg-white', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="text-[15px] font-bold tracking-[-0.01em]">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-muted">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-dark hover:-translate-y-px disabled:hover:translate-y-0',
  secondary: 'bg-white border border-line text-ink hover:border-brand hover:text-brand',
  soft: 'bg-canvas border border-line text-ink hover:border-brand hover:text-brand',
  ghost: 'bg-transparent text-muted hover:text-danger',
  danger: 'bg-white border border-line text-danger hover:border-danger hover:bg-danger-bg',
}

export function Button({ variant = 'primary', className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cx(
        'cursor-pointer rounded-[9px] px-4 py-3 text-[13px] font-semibold',
        'disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}

const BADGE_TONES = {
  neutral: 'text-muted-strong bg-canvas',
  brand: 'text-brand-dark bg-brand-50',
  success: 'text-success bg-success-bg',
  warn: 'text-warn bg-warn-bg',
  danger: 'text-danger bg-danger-bg',
}

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cx(
        'inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Avatar({ children, color = '#1E5FD8', size = 34, radius = 10, className }) {
  return (
    <div
      className={cx('flex flex-none items-center justify-center font-bold text-white', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color,
        fontSize: Math.round(size * 0.35),
      }}
    >
      {children}
    </div>
  )
}

/**
 * Barre de progression. `value` est en pourcentage ; la valeur est bornee pour
 * qu'une donnée aberrante ne deborde pas de la piste.
 */
export function ProgressBar({ value = 0, color = '#1E5FD8', height = 6, animate = true }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <div
      className="overflow-hidden rounded bg-line-soft"
      style={{ height }}
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx('h-full rounded origin-left', animate && 'animate-grow')}
        style={{ width: `${width}%`, background: color }}
      />
    </div>
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold text-ink">{label}</span>
      {children}
      {error ? (
        <span className="text-[11.5px] font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="text-[11.5px] text-muted">{hint}</span>
      ) : null}
    </label>
  )
}

/** Bandeau d'erreur homogene, utilise par tous les écrans. */
export function ErrorNotice({ error, onRetry }) {
  if (!error) return null

  return (
    <div className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-[13px] text-danger">
      <div className="font-semibold">{error.message || 'Une erreur est survenue'}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 cursor-pointer text-[12.5px] font-semibold underline"
        >
          Réessayer
        </button>
      ) : null}
    </div>
  )
}

/** Rectangle de chargement, aux dimensions du contenu attendu. */
export function Skeleton({ className, height = 16 }) {
  return (
    <div
      className={cx('animate-pulse rounded-lg bg-line-soft', className)}
      style={{ height }}
      aria-hidden="true"
    />
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {description ? <div className="max-w-md text-[12.5px] text-muted">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function SectionLabel({ children, className }) {
  return (
    <div
      className={cx(
        'text-[11px] font-bold uppercase tracking-[0.1em] text-muted',
        className,
      )}
    >
      {children}
    </div>
  )
}
