/**
 * Logo du centre : deux ailes et un corps, composes en CSS.
 * La maquette le dessine avec des `border-radius` asymetriques plutot qu'avec
 * une image, ce qui le garde net a toutes les tailles et suit la couleur du texte.
 */
function ButterflyMark({ size = 38, radius = 11, background = '#1E5FD8', className }) {
  const unit = size / 18 // la maquette dessine le papillon sur une base de 18px

  const upperWing = { width: 6 * unit, height: 5.14 * unit, background: '#FFFFFF' }
  const lowerWing = { width: 4.57 * unit, height: 4 * unit, background: 'rgba(255,255,255,0.78)' }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: radius,
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden="true"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0.72 * unit }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.4 * unit,
            alignItems: 'flex-end',
          }}
        >
          <div style={{ ...upperWing, borderRadius: '90% 40% 55% 20%', transform: 'rotate(-12deg)' }} />
          <div style={{ ...lowerWing, borderRadius: '60% 20% 65% 80%', transform: 'rotate(-6deg)' }} />
        </div>

        <div
          style={{
            width: 0.57 * unit,
            height: 7.14 * unit,
            background: '#FFFFFF',
            borderRadius: '40%',
            marginTop: 0.86 * unit,
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.4 * unit,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ ...upperWing, borderRadius: '40% 90% 20% 55%', transform: 'rotate(12deg)' }} />
          <div style={{ ...lowerWing, borderRadius: '20% 60% 80% 65%', transform: 'rotate(6deg)' }} />
        </div>
      </div>
    </div>
  )
}

export default ButterflyMark
