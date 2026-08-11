/**
 * En-tête d'écran : fil d'ariane, titre, recherche optionnelle et action principale.
 *
 * Colle en haut du defilement a partir de 1024 px, comme dans la maquette.
 * En dessous, il defile : c'est la barre du telephone (`AppLayout`) qui reste
 * fixe, et empiler deux bandeaux collants mangerait un quart de l'écran.
 *
 * Sous 640 px, recherche et action passent a la ligne et occupent toute la
 * largeur — un champ de 240 px et un bouton cote a cote ne tiennent pas a
 * cote d'un titre sur 375 px.
 */
function PageHeader({ crumb, title, search, action }) {
  return (
    <header className="z-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-white px-4 py-4 lg:sticky lg:top-0 lg:px-[34px] lg:py-[18px]">
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {crumb}
        </div>
        <h1 className="m-0 truncate text-[19px] font-bold tracking-[-0.02em] text-ink sm:text-[22px]">
          {title}
        </h1>
      </div>

      {search || action ? (
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          {search}
          {action}
        </div>
      ) : null}
    </header>
  )
}

/** Champ de recherche de l'en-tête, avec sa loupe dessinee en CSS. */
export function HeaderSearch({ value, onChange, placeholder = 'Rechercher un enfant…' }) {
  return (
    <div className="flex w-full items-center gap-2 rounded-[9px] border border-line bg-canvas px-3 py-2.5 sm:w-[240px]">
      <span className="h-3 w-3 flex-none rounded-full border-[1.6px] border-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
      />
    </div>
  )
}

/** Zone de contenu d'un écran, avec les marges de la maquette. */
export function PageBody({ children, className = '' }) {
  return (
    <div className={`flex flex-col gap-[22px] px-4 pb-11 pt-5 lg:px-[34px] lg:pt-7 ${className}`}>
      {children}
    </div>
  )
}

export default PageHeader
