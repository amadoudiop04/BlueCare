import { cx } from '@/lib/ui.js'

/**
 * Attente pendant le telechargement d'un écran.
 *
 * Les écrans arrivent en fichiers separes (`lib/routes.js`). Entre le clic et
 * leur arrivee, il faut occuper la place — mais pas trop vite : la plupart du
 * temps le fichier est déjà la (prechargement au survol) et le trajet dure
 * quelques millisecondes. Un indicateur affiche instantanement produirait un
 * clignotement a chaque navigation, plus penible que l'attente qu'il signale.
 *
 * D'ou le retard de 120 ms sur l'apparition : en dessous, on ne voit rien ;
 * au-dela, la barre confirme que le clic a bien été pris en compte.
 */
function RouteProgress({ full = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx('w-full flex-1', full && 'min-h-screen bg-canvas')}
    >
      <div
        className="h-[3px] w-full animate-fade overflow-hidden bg-brand-50"
        style={{ animationDelay: '120ms', animationDuration: '200ms' }}
      >
        <div className="h-full w-1/4 rounded-full bg-brand animate-sweep" />
      </div>
      <span className="sr-only">Chargement de l’écran…</span>
    </div>
  )
}

export default RouteProgress
