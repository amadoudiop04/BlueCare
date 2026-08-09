/**
 * Graphiques dessines en SVG, sans librairie.
 *
 * Les besoins sont modestes — deux formes, des valeurs en pourcentage — et une
 * dependance de graphes pese plus lourd que ces quelques lignes. Les axes sont
 * fixes de 0 a 100 : toutes les series de l application sont des taux, et une
 * echelle qui bouge donnerait l'illusion de progres inegaux.
 */

const WIDTH = 620
const HEIGHT = 190
const GRID = [0, 25, 50, 75, 100]

const toY = (value) => HEIGHT - (Math.max(0, Math.min(100, value)) / 100) * HEIGHT
const toX = (index, count) => (count <= 1 ? WIDTH / 2 : (index * WIDTH) / (count - 1))

/**
 * Courbes d evolution. Chaque serie porte `points: [number | null]` —
 * `null` signifie « pas de mesure ce mois-la » et coupe le trait plutot que
 * de tracer une ligne droite a travers une periode sans seance.
 */
export function LineChart({ series = [], labels = [], height = 200, emptyLabel }) {
  const hasData = series.some((entry) => entry.points.some((value) => value !== null))

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-line text-[12.5px] text-muted"
        style={{ height }}
      >
        {emptyLabel ?? 'Aucune mesure sur la periode'}
      </div>
    )
  }

  /** Decoupe une serie en segments continus, en sautant les trous. */
  const segmentsOf = (points) => {
    const segments = []
    let current = []

    points.forEach((value, index) => {
      if (value === null || value === undefined) {
        if (current.length > 1) segments.push(current)
        current = []
        return
      }
      current.push({ x: toX(index, points.length), y: toY(value) })
    })

    if (current.length > 1) segments.push(current)
    return segments
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`-6 -8 ${WIDTH + 12} ${HEIGHT + 16}`}
        style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Evolution : ${series.map((entry) => entry.label).join(', ')}`}
      >
        {GRID.map((value) => (
          <line key={value} x1={0} x2={WIDTH} y1={toY(value)} y2={toY(value)} stroke="#EEF1F7" strokeWidth={1} />
        ))}

        {series.map((entry, seriesIndex) =>
          segmentsOf(entry.points).map((segment, segmentIndex) => (
            <polyline
              key={`${entry.label}-${segmentIndex}`}
              points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={entry.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="animate-draw"
              style={{ strokeDasharray: 900, animationDelay: `${0.1 + seriesIndex * 0.18}s` }}
            />
          )),
        )}

        <g className="animate-fade" style={{ animationDelay: '1s' }}>
          {series.flatMap((entry) =>
            entry.points.map((value, index) =>
              value === null || value === undefined ? null : (
                <circle
                  key={`${entry.label}-${index}`}
                  cx={toX(index, entry.points.length)}
                  cy={toY(value)}
                  r={3.5}
                  fill="#fff"
                  stroke={entry.color}
                  strokeWidth={2}
                />
              ),
            ),
          )}
        </g>
      </svg>

      {labels.length > 0 ? (
        <div className="flex pt-2.5">
          {labels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="flex-1 text-center font-mono text-[11.5px] font-semibold text-muted"
            >
              {label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Barres groupees : une colonne par categorie, une barre par serie. */
export function GroupedBarChart({ groups = [], series = [], height = 190, emptyLabel }) {
  if (groups.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-line text-[12.5px] text-muted"
        style={{ height }}
      >
        {emptyLabel ?? 'Aucune donnee'}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end gap-[22px] border-b border-line px-1" style={{ height }}>
        {groups.map((group, groupIndex) => (
          <div key={group.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-[5px]">
              {series.map((entry, seriesIndex) => {
                const value = Math.max(0, Math.min(100, group.values[seriesIndex] ?? 0))

                return (
                  <div
                    key={entry.label}
                    title={`${group.label} · ${entry.label} : ${Math.round(value)}%`}
                    className="w-4 origin-bottom animate-growY rounded-t"
                    style={{
                      height: `${value}%`,
                      background: entry.color,
                      animationDelay: `${0.06 * groupIndex + 0.02 * seriesIndex}s`,
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-[22px] px-1 pt-2.5">
        {groups.map((group) => (
          <div
            key={group.label}
            className="flex-1 truncate text-center font-mono text-[11.5px] font-semibold text-muted"
            title={group.label}
          >
            {group.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChartLegend({ series = [], shape = 'square' }) {
  return (
    <div className="flex flex-wrap gap-5">
      {series.map((entry) => (
        <div key={entry.label} className="flex items-center gap-[7px] text-xs font-medium text-muted-strong">
          <span
            className={shape === 'line' ? 'h-[3px] w-3.5 rounded-sm' : 'h-[9px] w-[9px] rounded-sm'}
            style={{ background: entry.color }}
          />
          {entry.label}
        </div>
      ))}
    </div>
  )
}
