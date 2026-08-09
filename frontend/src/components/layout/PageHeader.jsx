/**
 * En-tête d'écran : fil d'ariane, titre, recherche optionnelle et action principale.
 * Colle en haut du defilement, comme dans la maquette.
 */
function PageHeader({ crumb, title, search, action }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-6 border-b border-line bg-white px-[34px] py-[18px]">
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {crumb}
        </div>
        <h1 className="m-0 truncate text-[22px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        {search}
        {action}
      </div>
    </header>
  )
}

/** Champ de recherche de l'en-tête, avec sa loupe dessinee en CSS. */
export function HeaderSearch({ value, onChange, placeholder = 'Rechercher un enfant…' }) {
  return (
    <div className="flex w-[240px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-3 py-2.5">
      <span className="h-3 w-3 flex-none rounded-full border-[1.6px] border-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
      />
    </div>
  )
}

/** Zone de contenu d'un écran, avec les marges de la maquette. */
export function PageBody({ children, className = '' }) {
  return (
    <div className={`flex flex-col gap-[22px] px-[34px] pb-11 pt-7 ${className}`}>{children}</div>
  )
}

export default PageHeader
