import logo from '/logoPapillonBleu.png'

/**
 * Logo du centre.
 *
 * L image porte ses propres couleurs et sa transparence : le fond colore
 * n'est donc plus pose par defaut, contrairement au papillon dessine en CSS
 * qu elle remplace. Les emplacements qui ont besoin d un cadre — un logo bleu
 * sur un degrade bleu se lit mal — passent explicitement `background`.
 *
 * Sans rapport avec le papillon ASCII de l ecran de connexion, qui reste
 * genere en Three.js (`AsciiButterfly.jsx`).
 */
function ButterflyMark({ size = 38, radius = 11, background, className }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: background ? radius : 0,
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Un cadre colore a besoin d'air autour du motif ; sans cadre, l image
        // occupe toute la place disponible.
        padding: background ? size * 0.14 : 0,
      }}
    >
      <img
        src={logo}
        // Le nom « BlueCare » accompagne toujours le logo en toutes lettres :
        // le decrire une seconde fois n'apporterait rien a un lecteur d'ecran.
        alt=""
        aria-hidden="true"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}

export default ButterflyMark
